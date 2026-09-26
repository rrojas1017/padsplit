# CR-010 Phase 1 — data layer for the per-script survey dashboards

No visible UI change. Three new files, plus one PE file where an existing helper gets the `export` keyword and nothing else.

## What exists today (inspected)

- `src/hooks/usePaymentExperienceResponses.ts`: pages through `booking_transcriptions` with `fetchAllPages` (1000 rows per page, capped at 10k), inner-joined to `bookings`, filtered to `research_campaign_type = 'payment_experience'`. It computes eligibility (voicemail / under 120s / fewer than 3 fields) and derives KPIs.
- `src/utils/paymentExperienceScriptResponses.ts`:
  - `summarizeQuestion` (private, and specific to PE question ids).
  - `derivePaymentExperienceScriptData`.
  - `normalizeAndMergeDistribution`, `applyLongTail` and `applyFixedOrder` (exported).
  - `buildPaymentExperienceScriptCsv` is an **aggregate** CSV: one row per question and answer label, with count, % and responses.
  - The helpers `trim(s, 240)`, `pct` and `csvEscape` are private.
- `src/utils/paymentExperienceAnalytics.ts`: `computeSurveyFunnel(all, eligible)` returns `FunnelStep { id, label, count }[]`. The type is exported, and trailing zero steps are trimmed down to 2.
- `filterByDateRange` is private in `PaymentExperienceInsightsDashboard.tsx`. It compares `booking_date` as a 'yyyy-MM-dd' string against local bounds.
- `src/utils/researchCampaignType.ts`: `resolveResearchCampaignType(script)` returns `script_<id8>` for these two scripts, since neither has a mapped id or a built-in slug.
- `ScriptQuestion` in `useResearchScripts.ts` already carries `id`, `order`, `question`, `type`, `options`, `scale_min`, `scale_max`, `section`, `ai_extraction_hint` and `is_internal`.

## Build

1. **`src/hooks/useScriptSurveyResponses.ts`**, `useScriptSurveyResponses(scriptId)` using react-query:
   - Load the script from `research_scripts` (`id, name, slug, questions`) and drop questions marked `is_internal`. Question ids go through `ensureQuestionIds`, so the keys match `raw_script_answers`.
   - Page with `fetchAllPages` over `booking_transcriptions`:
     - Select `research_campaign_type`, `research_processing_status`, `raw_script_answers:research_extraction->raw_script_answers` and `survey_progress`.
     - Inner join `bookings!inner(id, booking_date, call_duration_seconds, has_valid_conversation, transcription_status, kixie_link, research_call_id, record_type)`.
     - Filters: `.eq('research_campaign_type', campaignType)` and `.eq('bookings.record_type','research')`, ordered by id. Only the viewer's session is used (normal RLS).
   - Each record gets:
     - `answers` per question id.
     - `answeredCount`: an answer counts only if it has at least one selected label, a finite `scale_value`, or text that is not blank after trimming.
     - `isForm`: at least one entry has source `agent_runtime`.
     - `hasRecording`: `!!kixie_link`.
   - Returns `{ script, questions, sections, records, validRecords, eligibleRecords, isLoading }`. `sections` follows question order and has no duplicates.
   - `survey_progress` is read with the same "column or JSON path" approach the build confirms against types.ts. If it is not a real column, the plan falls back to `research_extraction->survey_progress`.
2. **`src/utils/scriptSurveyAnalytics.ts`** (pure functions):
   - `hasAnswerValue(entry)`
   - `summarizeScriptQuestion(q, eligible)`:
     - Choice questions: label distribution. The % denominator is the number of members who answered.
     - Scale questions: avg, min and max, with one bucket per integer from `scale_min` to `scale_max`. The default is 1–5.
     - Open-ended questions: `samples` (first 25, each cut to 240 chars) and `allResponses`.
   - `deriveScriptSurveyStats(questions, eligible)`, as specified.
   - `computeScriptSurveyFunnel(records, valid, eligible, questions)` returns PE's `FunnelStep[]`: Routed → Valid conversation → Answered at least 1 → Answered at least 50% → Answered all.
   - `buildScriptSurveyCsv(questions, eligible)`: one row per record, with booking id and date, form/recording flags, then one column per question. Multiple choices are joined with "; ". The escaping is a copy of PE's `csvEscape` rule.
   - `filterByDateRange` is re-exported from its PE location.
3. **`src/config/scriptSurveyKpis.ts`**: two six-tile configs keyed by script id, exactly as listed in the ticket, plus `computeScriptKpis(config, questions, eligible)` which returns `{ value, numerator, denominator }` for each tile.
   - `count`: eligible over routed.
   - `avg`: mean of the scale answers for the hint's question.
   - `pct`: share of answered records whose labels include one of the `positiveOptions`.
   - `value` is null when nobody answered.
   - Option matching trims the text and ignores case, and treats "—" and "-" as the same, so small dash differences still match.

## The one PE change

`filterByDateRange` in `PaymentExperienceInsightsDashboard.tsx` gets the keyword `export`. Its body stays byte-for-byte the same. Nothing else in PE, Move-Out or Audience changes.

## Acceptance

The QA team checks these against SQL:

| Script | routed | valid | eligible | eligible with form | eligible recording-only | answered values |
|---|---|---|---|---|---|---|
| Non-Booking | 2510 | 156 | 33 | 7 | 26 | 180 |
| 30-Day | 278 | 41 | 40 | 23 | 17 | 581 |

Mapping to the hook's output:

- **routed** = `records.length`
- **valid** = `validRecords.length`
- **eligible** = `eligibleRecords.length`
- **with form** = eligible records where `isForm` is true
- **recording-only** = eligible records where `isForm` is false
- **answered values** = sum of `answeredCount` over eligible records

## Points to note

- The ticket asks for a CSV with one row per record, while PE's CSV is aggregate. The plan follows the ticket.
- "Answered ≥50%" means `answeredCount >= ceil(questions.length / 2)`.

## Out of scope

`ScriptInsightsPanel`, edge functions, the database, types.ts, new dependencies, publishing.

## Verification

`tsgo --noEmit -p tsconfig.app.json`.
