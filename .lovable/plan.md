
# Phase 1D — Move-Out Deterministic Linkage Cleanup

## Current State (verified)

- `conversation_submissions.campaign = 'Q1-Research-2026'`: **31,636 rows**, every one has a `booking_id`.
- Joined `booking_transcriptions`: **23,935 rows**, all stamped `research_campaign_type='move_out_survey'` via column default, `retag_source = NULL`. The other ~7.7k bookings have no transcription yet.
- `research_campaigns` Move-Out row (`2dfa12b2…`) has `campaign_key = 'Move-in-out-Research:-Member-experience-&-Reason-code-Classification'` → script `6397bb7f…` (slug `satisfaction`, type `satisfaction`).
- Resolvers in `submit-conversation-audio` and `backfill-deterministic-linkage` already map `satisfaction → move_out_survey` and stamp `retag_source='script_id_route'`. They simply find no `campaign_key` match for the raw string `Q1-Research-2026`, so the deterministic path is skipped and the default kicks in.

**Conclusion:** the architecture is already correct. The only missing piece is a canonical campaign identity for the string `Q1-Research-2026`.

## Recommended Canonical Handling

**Approach A — Insert a new `research_campaigns` row** keyed `Q1-Research-2026`, pointing at the existing Move-Out script.

| Approach | Pros | Cons |
|---|---|---|
| **A. New campaign row (recommended)** | No schema change. Existing Move-Out campaign untouched. Mirrors the proven Payments/Audience pattern. Future Q2/Q3 just drop in another row. | One extra row to manage. |
| B. Rename existing campaign's `campaign_key` to `Q1-Research-2026` | Single row. | Loses original key; couples identity to a single quarter; breaks if older traffic ever uses the original key. |
| C. Add `campaign_aliases` array column + resolver rewrite | Most flexible long-term. | Schema migration, index, resolver changes — out of scope for a linkage fix. |

Proposed row values:

```
name:         "Q1-Research-2026 — Move-Out (Member Experience & Reason Codes)"
campaign_key: "Q1-Research-2026"
script_id:    6397bb7f-ac6a-49ea-90ad-9ca6ec046434
status:       active
```

Because both campaign rows point at the **same script**, resolvers automatically produce `research_campaign_type = 'move_out_survey'` and `retag_source = 'script_id_route'`. No ingestion code changes required.

## Expected Rows Affected

- `research_calls` inserted: up to **23,935** (one per Q1 submission whose booking has a transcription and no `research_call_id`).
- `bookings.research_call_id` updated: same.
- `booking_transcriptions.retag_source` flipped NULL → `script_id_route`: same. `research_campaign_type` value unchanged (already `move_out_survey`); the win is provenance, not the value.
- ~7.7k Q1 submissions without a transcription will be picked up via the same path once transcription completes.

## Plan

### Step 1 — Confirm recommendation (no writes)
Pause here for approval of Approach A and the proposed row values above.

### Step 2 — Insert canonical campaign row
Single-row insert into `research_campaigns`. Reversible by deleting the row.

### Step 3 — Live ingestion verification
Submit a synthetic `Q1-Research-2026` payload via `submit-conversation-audio`. Confirm:
- `research_calls` row created with `campaign_id` = new row
- `bookings.research_call_id` populated
- `booking_transcriptions.research_campaign_type='move_out_survey'`, `retag_source='script_id_route'`

Clean up the synthetic record afterward.

### Step 4 — Dry-run backfill audit
`backfill-deterministic-linkage` with `{"dryRun": true, "campaignFilter": "Q1-Research-2026", "includeSnapshot": true}`, paginated to completion. Return:
- expected rows affected (full counts, not sampled)
- proposed `retag_source` (`script_id_route`)
- unresolved / skipped counts
- before-snapshot of `research_calls` and linked-bookings counts

### Step 5 — Paginated write backfill (only after explicit approval)
Same function with `{"dryRun": false, "limit": 1500, "cursor": "<last_processed_conversation_submission_id>", "campaignFilter": "Q1-Research-2026"}`, chained until `remaining_estimate === 0`. Deterministic `ORDER BY conversation_submissions.id ASC`. Idempotent — already skips rows stamped `script_id_route`.

### Step 6 — Post-run audit
Return:
- final `retag_source × research_campaign_type` breakdown
- total `script_id_route` rows
- per-row failures / skipped rows
- visual confirmation that Move-Out dashboards still render

### Step 7 — Default-column evaluation (report only)
After Step 6 is clean, surface a recommendation on whether `booking_transcriptions.research_campaign_type DEFAULT 'move_out_survey'` can be dropped in a later phase. **No removal in 1D.**

## Safeguards

- **Deterministic precedence preserved:** resolver already prefers `research_call_id → campaign → script` over keyword fallback. No logic changes.
- **Idempotency:** backfill already skips rows where `retag_source='script_id_route'`.
- **Auditability:** dry-run returns full counts via cursor pagination (fix from 1C is in place).
- **Rollback:**
  - Step 2: `DELETE FROM research_campaigns WHERE campaign_key='Q1-Research-2026'`.
  - Step 5: backfilled rows identifiable via `research_calls.campaign_id = <new row id>`. Targeted UPDATE can revert `retag_source` to NULL and null out `bookings.research_call_id`, then delete the matching `research_calls` rows.

## Out of Scope
Dashboard/UI changes, default-column removal, keyword tuning, AI prompt edits, analytics expansion.

---

**Awaiting approval of Approach A and the proposed campaign row** before proceeding to Step 2. After Step 4 (dry-run), I'll stop again for explicit write-backfill approval.
