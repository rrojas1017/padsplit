# Capture Actual Dues Day for Q2 — Implementation Plan

Approved as specified. Below is the concrete execution plan.

## 1. Type extension — no DB migration

**File:** `src/types/research-insights.ts` (`PaymentExperienceExtraction.payment_literacy_breakdown`)

Add to the existing object type, alongside the current four booleans:

```ts
dues_day_stated?:
  | 'monday' | 'tuesday' | 'wednesday' | 'thursday'
  | 'friday' | 'saturday' | 'sunday' | 'unknown' | null;
dues_day_stated_raw?: string | null;
```

Keep `pay_cadence_known`, `dues_day_correct`, `dues_amount_correct`, `commitment_understood` untouched.

## 2. Extraction prompt updates (no model change)

### A. Fallback prompt
**File:** `supabase/functions/process-research-record/index.ts` → `PAYMENT_EXPERIENCE_FALLBACK_PROMPT`.

The current fallback prompt does not emit `payment_literacy_breakdown` at all. Add the breakdown object to the JSON shape so fallbacks produce the same structure as the live script, including the two new fields. Existing keys (`pay_cadence_known`, `dues_day_correct`, `dues_amount_correct`, `commitment_understood`) included for parity.

### B. Live script prompt
**Table:** `research_scripts`, row `c701a243-1c66-425a-8f79-99a290ec5b6b` (PadSplit Member Payment Experience Survey).

Update `ai_prompt` via `supabase--insert` (UPDATE) to extend `payment_literacy_breakdown` with:

```
"dues_day_stated": "monday|tuesday|wednesday|thursday|friday|saturday|sunday|unknown|null",
"dues_day_stated_raw": "raw phrase from transcript or null"
```

Plus normalization rules in the Rules section:
- "every Monday" / "Mondays" / "on Monday" / "Monday morning" → `monday` (and similar for other weekdays).
- Member unsure / can't identify / doesn't know → `unknown`.
- Q2 not present in transcript → `unknown`.
- `null` only when extraction cannot be performed at all.
- `dues_day_stated_raw` preserves the verbatim phrase.
- Continue producing `dues_day_correct` exactly as today.

Model stays `google/gemini-2.5-flash`.

## 3. Historical backfill edge function

**New function:** `supabase/functions/backfill-payment-experience-dues-day/index.ts`

Behavior:
- Self-retriggering chunked job (~25 records/chunk, ~10s pause between chunks).
- Idempotent and resumable.
- Uses `SUPABASE_SERVICE_ROLE_KEY` and `LOVABLE_API_KEY`.
- Selection (run against `booking_transcriptions`):

```sql
research_campaign_type = 'payment_experience'
AND call_transcription IS NOT NULL
AND length(trim(call_transcription)) > 0
AND (
  research_extraction->'payment_literacy_breakdown'->>'dues_day_stated' IS NULL
  OR research_extraction->'payment_literacy_breakdown'->>'dues_day_stated' = ''
)
```

Per row:
- Call `google/gemini-2.5-flash-lite` via Lovable AI Gateway, temperature 0, with a tiny single-purpose prompt that takes the transcript and returns strictly:

```json
{ "dues_day_stated": "...", "dues_day_stated_raw": "..." }
```

- Validate the returned `dues_day_stated` against the allowed enum; coerce invalid values to `unknown`.
- Merge into `research_extraction.payment_literacy_breakdown`, preserving every other key. Skip the row if `dues_day_stated` is already present and non-empty (race-safe).
- Log to `api_costs` with `service_type = 'research_payment_experience_backfill_duesday'`, `service_provider = 'lovable_ai'`, `is_internal = true`, plus token counts and `booking_id`.

Trigger: one-shot manual `supabase--curl_edge_functions` POST. No UI button.

## 4. Frontend rendering

**File:** `src/utils/paymentExperienceScriptResponses.ts`

- In `PE_QUESTIONS`, replace the Q2 entry:
  ```ts
  { order: 2, id: 'dues_day_stated',
    text: 'What is your payment schedule for your PadSplit room?',
    section: 'Payment literacy baseline', type: 'multi' },
  ```
- In `getAnswer()`, replace the `dues_day_awareness` case with a `dues_day_stated` case:
  - Read `breakdown.dues_day_stated`.
  - Missing/null/empty → `null`.
  - Valid day or `'unknown'` → `[value]`.
- Add a `DAY_LABELS` map for monday…sunday + unknown.
- Update `labelFor()` so `qId === 'dues_day_stated'` uses `DAY_LABELS`.
- Force fixed display order for Q2 only: Monday → Tuesday → Wednesday → Thursday → Friday → Saturday → Sunday → Unknown. Implement by post-sorting the `distribution` array when `q.id === 'dues_day_stated'`, keeping zero-count days out (only render days that occurred + Unknown if present), but never sort by count for this question.
- Remove `'dues_day_awareness'` from the yes/no branch in `labelFor()`.

`ScriptQuestionGraphCard` then renders Q2 automatically through the existing multi-bar path. The Overview tab keeps Q2 in its current slot, now showing day-of-week distribution.

`dues_day_correct` remains in the schema and may continue to be used by other internal logic — it's just no longer surfaced as Q2.

## 5. Validation steps

After deploying and running the backfill once:

1. SQL spot-check (10 rows) of `dues_day_stated` + `dues_day_stated_raw`.
2. SQL grouped distribution by `dues_day_stated`.
3. Visit `/research/insights?campaign=payment_experience` and confirm Q2 renders as a Monday→Sunday + Unknown horizontal bar distribution; the old Yes/No bars are gone for Q2.
4. Confirm `api_costs` rows exist with `service_type = 'research_payment_experience_backfill_duesday'`.

## Guardrails

No DB migration. No removal of `dues_day_correct`. No overwrite of populated values. No Bulk Processing UI button. No changes to KPIs, Script Responses layout, other extraction fields, or formulas.

## Execution order

1. Update `src/types/research-insights.ts`.
2. Update fallback prompt in `process-research-record/index.ts`.
3. UPDATE `research_scripts.ai_prompt` for the Payment Experience row.
4. Create `backfill-payment-experience-dues-day` edge function.
5. Update `src/utils/paymentExperienceScriptResponses.ts` (Q2 swap + DAY_LABELS + fixed order).
6. Deploy the new edge function and trigger it once via curl.
7. Run SQL validation queries and verify dashboard.
