# Payment Experience `raw_script_answers` Reconstruction Backfill

Approved scope. One unified chunked backfill plus a prompt hardening pass — no frontend changes.

## Files

- **Create:** `supabase/functions/backfill-payment-experience-raw-script-answers/index.ts`
- **Edit:** `supabase/functions/process-research-record/index.ts`

## 1. New edge function: `backfill-payment-experience-raw-script-answers`

Mirrors the proven `backfill-payment-experience-dues-day` pattern (chunked, self-retriggering, server-side filter, `api_costs` logging).

### Constants
- `CHUNK_SIZE = 25`
- `PACE_MS = 10_000`
- `MODEL = 'google/gemini-2.5-flash'`
- `SERVICE_TYPE = 'research_payment_experience_backfill_raw_answers'`
- `EDGE_FUNCTION = 'backfill-payment-experience-raw-script-answers'`
- `BACKFILL_VERSION = 1`
- `EXPECTED_QUESTION_IDS` — canonical 17 ids pulled from `paymentExperienceScriptResponses.ts` (Q1 `pay_cadence` … Q16 `wish_capability`, including Q3a/Q3b split).

### Eligibility (server-side filter)
`booking_transcriptions` rows where:
- `research_campaign_type = 'payment_experience'`
- `call_transcription IS NOT NULL` AND length > 0
- AND either:
  - `research_extraction->'raw_script_answers' IS NULL`, OR
  - `jsonb_object_keys` count on `raw_script_answers` < expected canonical count

Implementation: fetch with the same `.is(...'raw_script_answers', null)` shortcut plus a fallback in-memory key-count check for partially populated rows (the `jsonb_object_keys` count predicate isn't expressible cleanly in PostgREST, so we over-fetch and skip rows already at full canonical coverage). Ordered by `id` for stable paging.

### Prompt
Asks for the canonical `raw_script_answers` map keyed by the 17 question ids. Per-entry shape:

```
{
  question_id, question_text, question_type,
  selected_option_labels: string[],
  raw_text_answer: string | null,
  scale_value: number | null,
  source: "ai_backfill_v1",
  confidence: "high" | "medium" | "low",
  status: "answered" | "not_discussed" | "unclear",
  supporting_quote: string | null   // ≤ 240 chars
}
```

Rules inlined in the system prompt:
- Never fabricate. If a question isn't discussed → `status: "not_discussed"`, empty labels, null text/scale.
- Ambiguous → `status: "unclear"`.
- `status: "answered"` only when supported by the transcript.
- Per-question normalized vocabularies inlined from `paymentExperienceScriptResponses.ts`:
  - **Q2** weekday enum (`monday`…`sunday`, `unknown`)
  - **Q3a** USD number (or `unsure`)
  - **Q3b** allowed amenity tokens
  - **Q4** commitment enum
  - **Q7** payment method + device label sets
  - **Q9** autopay-barrier enum
  - **Q10** numeric 1–5 `scale_value`
  - **Q11** friction theme enum
  - **Q12** USD overdue threshold (numeric)
  - **Q15** desired payment method enum (array)
  - **Q16** wish capability single label

### Critical merge rule (source-priority preserving)

```
priority: agent_runtime > ai_extraction > ai_backfill_v1
```

For each question id in the model output:
- If existing entry exists AND its `source` is `agent_runtime` or `ai_extraction` AND it's well-formed → **keep existing, skip**.
- If existing entry is missing, null, or malformed (no `question_id`, no `status`, or shape invalid) → write new `ai_backfill_v1` entry.
- Never delete keys present in existing `raw_script_answers`.

Patch via `jsonb_set` on `research_extraction.raw_script_answers` (merged object), and also set:

```
research_extraction.raw_script_answers_meta = {
  backfill_version: 1,
  last_backfilled_at: <ISO>,
  model: "google/gemini-2.5-flash",
  source: "ai_backfill_v1"
}
```

`payment_literacy_breakdown` and all other extraction fields are untouched.

### Cost logging
Insert into `api_costs` per row: `service_type`, `edge_function`, `is_internal: true`, `booking_id`, token counts, `estimated_cost_usd` computed from gemini-2.5-flash rates, `metadata: { model }`.

### Self-retrigger
Same `queueMicrotask` + `setTimeout(PACE_MS)` POST back to self with `{ chained: true }` whenever `fetched.length >= CHUNK_SIZE`.

## 2. Prompt update: `process-research-record/index.ts`

Strengthen the Payment Experience extraction prompt so new records emit a complete `raw_script_answers` map:
- Make `raw_script_answers` **mandatory** for every question discussed.
- Require per-entry `status`, `confidence`, `supporting_quote`, `selected_option_labels`, `raw_text_answer`, `scale_value` where applicable.
- Inline the same normalized vocabularies as the backfill prompt (single source of truth — pulled from `paymentExperienceScriptResponses.ts` mappings).
- Keep all existing extraction fields untouched (no schema breakage).

## 3. Execution

1. Deploy both edge functions.
2. Trigger backfill once via `curl_edge_functions` POST `/backfill-payment-experience-raw-script-answers` with `{ chained: false }`.
3. Let it self-chain to completion.
4. Monitor `api_costs` and edge logs.

## 4. Validation queries (post-run)

Re-run the per-question coverage query. Expected:
- Q2 stays ~100%.
- Q8 (autopay) reaches natural high coverage (asked of most members).
- Q3a/Q3b/Q4/Q7/Q9/Q10/Q11/Q12/Q15 increase substantially where actually discussed.
- `not_discussed` count visible for optional questions — no inflation.
- All backfill-written entries carry `status` + `confidence` + `source: "ai_backfill_v1"`.
- `raw_script_answers_meta` populated on every backfilled row.

## Acceptance criteria

- Historical coverage rises substantially across all 17 PE questions.
- Zero overwrites of `agent_runtime` or valid `ai_extraction` entries.
- `ai_backfill_v1` entries always include `status` + `confidence`.
- `raw_script_answers_meta` present on processed rows.
- `api_costs` logs the run under `research_payment_experience_backfill_raw_answers`.
- No frontend changes, no TS errors, no dashboard regressions.

## Cost estimate

~3,546 rows × gemini-2.5-flash ≈ **$3–6 total**, auditable in `api_costs`.
