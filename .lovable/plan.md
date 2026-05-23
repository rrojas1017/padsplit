## Goal

Stop the broad Payment Experience `raw_script_answers` backfill and instead reconstruct the 17-question map only for the **248 dashboard-eligible** calls. Cuts remaining cost from ~$20+ to ~$1.50 and finishes in 10–20 min.

## 1. Hard-stop the broad backfill (no concurrent writers)

Two layers:

- **Unschedule** the `pe-backfill-watchdog` `pg_cron` job so nothing re-kicks it.
- **Kill switch in code:** add `const BROAD_BACKFILL_DISABLED = true` at the top of `supabase/functions/backfill-payment-experience-raw-script-answers/index.ts`. Early-return at the start of the handler with `{ disabled: true }` and a log line. Comment explains why and forbids re-enabling without owner approval. Already-stamped rows are left untouched.

## 2. New targeted edge function

`supabase/functions/backfill-payment-experience-eligible-only/index.ts` — same 17-question prompt, same canonical schema, same merge logic, same chunked self-chain pattern (chunk size 25, 10s pacing, `EdgeRuntime.waitUntil`).

New accounting:
- `service_type = 'research_payment_experience_backfill_eligible_only'`
- `edge_function = 'backfill-payment-experience-eligible-only'`

### Eligibility (must match `evaluateEligibility` in `src/hooks/usePaymentExperienceResponses.ts`)

A `booking_transcriptions` row with `research_campaign_type = 'payment_experience'`, joined to `bookings`, where:

- `bookings.has_valid_conversation` IS NULL or TRUE
- `bookings.call_duration_seconds` IS NULL, 0, or ≥ 120
- `research_extraction` has ≥ 3 of: `payment_literacy_score`, `autopay_status`, `move_in_cost_clarity_1to5`, `pay_cadence`, `top_friction_theme`

Implementation: server-side PostgREST filter on the `bookings!inner` join for the duration/voicemail rules; in-memory ≥3-of-5 JSON check; overfetch to find 25 eligible per chunk. Already-stamped rows skipped via the new marker.

### Dry-run guardrail (first non-chained invocation)

Counts uncompleted eligible candidates. If the count is **<200 or >300** the function aborts with `{ aborted: true, eligible_count }` and logs a mismatch. Otherwise it proceeds. Verified expected count = **248**.

### Per-row marker

```json
"raw_script_answers_eligible_backfill_version": 1,
"raw_script_answers_eligible_backfill_meta": {
  "version": 1,
  "last_backfilled_at": "<ISO>",
  "model": "google/gemini-2.5-flash",
  "source": "ai_backfill_eligible_v1",
  "service_type": "research_payment_experience_backfill_eligible_only"
}
```

`raw_script_answers_meta` and all other extraction fields are preserved verbatim.

### Merge policy (per question entry)

Trust order (highest → lowest):
1. `agent_runtime`
2. valid `ai_extraction`
3. `ai_backfill_eligible_v1`
4. `ai_backfill_v1`

The eligible-only run may overwrite:
- missing or malformed entries
- entries with `source: "ai_backfill_v1"`
- prior `ai_backfill_eligible_v1` entries with `status: "not_discussed"` or `"unclear"` when the new pass produces a transcript-supported `"answered"` entry

It must never overwrite:
- `agent_runtime`
- well-formed `ai_extraction`
- any entry marked with a manual-correction flag (forward-compatible check)

Each written entry includes: `question_id`, `question_text`, `question_type`, `selected_option_labels`, `raw_text_answer`, `scale_value`, `status`, `confidence`, `supporting_quote`, `source: "ai_backfill_eligible_v1"`.

## 3. Execution

1. Deploy both functions.
2. Unschedule `pe-backfill-watchdog`.
3. Confirm broad function returns `disabled: true` via one curl.
4. Trigger eligible-only once: `POST /backfill-payment-experience-eligible-only` with `{ chained: false }`.
5. Monitor via `api_costs` and edge logs.

Expected: ~10 chunks, ~10–20 min runtime, ~$1.50 cost.

## 4. Validation

- Stamped count: rows with `raw_script_answers_eligible_backfill_version = 1` ≈ 248 minus failures
- Cost rows under new `service_type`
- Sample 5 rows: status/confidence/supporting_quote present, `not_discussed` used instead of hallucinations, key questions populated where discussed
- Dashboard at `/research/insights` continues to read `raw_script_answers` unchanged; eligible-call charts improve

## Guardrails (no-ops)

No dashboard logic, frontend, KPI, prompt-outside-target, UI button, or DB-migration changes. No deletion of broad-backfill rows. No concurrent broad+targeted runs.

## Files changed

- `supabase/functions/backfill-payment-experience-raw-script-answers/index.ts` — add `BROAD_BACKFILL_DISABLED = true` kill switch + early-return guard
- `supabase/functions/backfill-payment-experience-eligible-only/index.ts` — new
- Unschedule `pe-backfill-watchdog` cron job (data change, not a migration)
