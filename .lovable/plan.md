# Phase 1C — Deterministic Linkage Implementation

Approved Phase 1B trace established the root cause: `submit-conversation-audio` never creates `research_calls` rows or sets `bookings.research_call_id`, and its campaign lookup fails for Payments submissions (which arrive as the campaign UUID, not the `campaign_key`). Phase 1C closes that loop with strict guardrails.

## Guardrails (must hold for every change)

1. **Dry-run first.** Backfill ships with `dryRun: true` as the default. In dry-run mode the function performs only SELECTs and returns a JSON preview — zero writes.
2. **Deterministic linkage wins.** Once a record resolves via `booking → research_call → campaign → script`, the keyword fallback in `detectCampaignContext` is short-circuited and may not reclassify it.
3. **Keep the column default.** `booking_transcriptions.research_campaign_type` keeps its current `'move_out_survey'` default for backward compatibility. Removal is deferred to a later phase after production stability.
4. **Auditability.** Every backfilled row carries `retag_source = 'script_id_route'`. A revert query can identify them; before/after counts are included in every backfill response.

## Scope of changes

### A. `submit-conversation-audio` — close the loop at write time

- Broaden campaign resolution: match `research_campaigns` by `id` OR `campaign_key` (current code only matches `campaign_key`, which fails for Payments).
- When matched, also load `research_scripts.{id, slug, campaign_type}` for the campaign's `script_id`.
- INSERT a `research_calls` row (`campaign_id`, `caller_phone`, `kixie_link`, `call_date = today`, minimal required fields). Capture its `id`.
- INSERT the `bookings` row with `research_call_id` populated.
- Resolve the canonical `research_campaign_type` from `script.slug` (`payment_experience`, `audience_survey`, …) using the same waterfall already in `process-research-record` (`SCRIPT_ID_MAP` → slug → `campaign_type`). When known, after the auto-transcription trigger creates the `booking_transcriptions` row, UPDATE it with `research_campaign_type = <resolved>` and `retag_source = 'script_id_route'`. (We don't change the column default; we just overwrite at known-good moments.)
- If no campaign matches, behavior is unchanged (current keyword-fallback path stays intact).

### B. `process-research-record` → `detectCampaignContext` — enforce precedence

Current order is already script-first, fallback-second, but the short-circuit added in Phase 1A only protects pre-set values that aren't `'move_out_survey'`. Tighten to:

- If `booking.research_call_id` resolves a `script_id` → return that `campaignType` immediately. **Never** consult the keyword fallback in this case.
- If the row already carries `retag_source = 'script_id_route'` → trust it; never reclassify.
- Keyword fallback continues to apply only when neither linkage nor a prior deterministic stamp exists.

When the keyword fallback does fire and lands on `payment_experience` or `audience_survey`, stamp `retag_source = 'keyword_fallback_detection'` (closes the gap noted in Phase 1A's TODO).

### C. New edge function: `backfill-deterministic-linkage` (dry-run by default)

POST body:
```json
{ "dryRun": true, "limit": null, "campaignFilter": null }
```

Selection set (one query, joined): `conversation_submissions` whose `campaign` resolves to a `research_campaigns` row by `id` OR `campaign_key`, and whose linked `bookings.research_call_id IS NULL`.

**Dry-run response (no writes):**
```json
{
  "mode": "dry_run",
  "expected_rows_affected": 6430,
  "by_resolved_campaign_type": {
    "payment_experience": 4767,
    "audience_survey": 1663
  },
  "by_current_transcription_campaign_type": {
    "move_out_survey": 6201,
    "payment_experience": 24,
    "audience_survey": 204,
    "null": 1
  },
  "by_proposed_retag_source": {
    "script_id_route": 6430
  },
  "preview_sample_ids": ["…", "…"]
}
```

**Write mode (`dryRun: false`):** for each selected submission, in chunks of ~200, perform a single transaction that:
1. INSERTs into `research_calls` (campaign_id, caller_phone = submission.phone_number, kixie_link = submission.audio_url, call_date = booking.booking_date).
2. UPDATEs `bookings.research_call_id` for that submission's `booking_id`.
3. UPDATEs the corresponding `booking_transcriptions.research_campaign_type` to the resolved value AND sets `retag_source = 'script_id_route'`. Existing `retag_source` values (`payment_keyword_validation`, `keyword_fallback_detection`) are overwritten — script-id linkage is the higher-precedence source.

Write-mode response includes:
```json
{
  "mode": "write",
  "before_counts": { "research_calls": 0, "bookings_with_research_call_id": 0, "transcriptions_by_campaign_type": { … } },
  "after_counts":  { "research_calls": 6430, "bookings_with_research_call_id": 6430, "transcriptions_by_campaign_type": { … } },
  "rows_inserted_research_calls": 6430,
  "rows_updated_bookings": 6430,
  "rows_updated_transcriptions": 6430,
  "retag_source_breakdown_after": { "script_id_route": 6430, "payment_keyword_validation": 15, "keyword_fallback_detection": 9 }
}
```

### D. Audit & rollback

- Every transcription row written by the backfill carries `retag_source = 'script_id_route'`. Identification query:
  ```sql
  SELECT id, booking_id FROM booking_transcriptions WHERE retag_source = 'script_id_route';
  ```
- Every `research_calls` row inserted by the backfill is identifiable as: `created_at >= <backfill start>` AND no `researcher_id` (this function never sets one).
- Rollback (separate manual SQL, not auto-run): set affected `research_campaign_type` back to `'move_out_survey'`, clear `retag_source`, null out `bookings.research_call_id`, delete the matching `research_calls` rows.
- Run order is **always**: dry-run → review counts with user → write.

## Out of scope for Phase 1C

- Removing the `booking_transcriptions.research_campaign_type` default.
- Phase 2 aggregations / Phase 3 AI synthesis.
- Loosening keyword detection.
- Backfilling submissions whose `campaign` string matches no `research_campaigns` row (e.g. `Q1-Research-2026`) — flagged separately for a follow-up "alias resolution" task.

## Verification after write-mode run

1. `SELECT count(*) FROM research_calls;` should jump from 0 to ~6,430.
2. `SELECT count(*) FROM bookings WHERE research_call_id IS NOT NULL AND record_type='research';` matches.
3. `SELECT research_campaign_type, count(*) FROM booking_transcriptions WHERE research_campaign_type='payment_experience';` should reach ~4,767.
4. Reload `/research/insights?campaign=payment_experience`; "Members Surveyed" reflects the new total; the Phase 1A banner disappears (since most records now carry `script_id_route`).
