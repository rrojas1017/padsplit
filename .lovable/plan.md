# CR-019 — Group unmatched answers under "Other" (Research Insights)

Frontend only. No database, migration, SQL, function, RLS or AI prompt change. Stored answers are not modified. No new dependencies. Nothing published.

## What the user will see
On the 30-Day, Non-Booking and Member Screening dashboards (Overview, topic tabs, Script Responses tab, grid cards, Download Report, Word brief), choice questions show their normal option rows plus at most one **"Other"** row, always last and only when it has answers. Long sentences and transcript fragments no longer appear as separate rows. Clicking "Other" opens the usual panel ("N respondents — Other"). Each person in that panel also shows their actual answer in small grey text that wraps. Clicking a normal option works as it does today, with no answer text.

## The single rule (new shared helper)
`src/utils/scriptSurveyOptionMatch.ts` (pure):
- `matchOption(q, label)` returns the English option when `label`, trimmed and compared case-insensitively, equals an English option or the Spanish option at the same position. Otherwise it returns `null` (UNMATCHED).
- `splitAnswerLabels(q, entry)` returns `{ matched: string[] (English, deduped), unmatched: string[] }`, using the same label extraction as today (`answerLabels`, plus the `answerText` fallback for single-choice and yes/no).
- `OTHER_LABEL = 'Other'`, the same string as the existing `GRID_OTHER`.
- Questions with no `options`, plus scale and open questions, are left exactly as they are today.

Counting:
- **Option rows:** respondents whose matched labels include that option.
- **Other:** respondents with at least one unmatched label.
- **Base:** answered = respondents with at least one matched or unmatched label. This is the same base as today, so single-choice rows still add up to 100% and multi-select stays "% of respondents".
- **Case variants:** variants of the same option (for example "yes" and "Yes") now count in that option's single row. This is required by rule 1.
- **Existing "Other" option (assumption):** if a question already has an option literally called "Other", unmatched answers fold into that row. That avoids two rows with the same name.

## Files
- `src/hooks/useScriptSurveyResponses.ts`: also read `questions_es` in the existing script select (same table, same permissions). Attach `options_es` to each question by matching question id, falling back to position.
- `src/utils/scriptSurveyOptionMatch.ts` (new): the rule above.
- `src/utils/scriptSurveyAnalytics.ts`: `summarizeScriptQuestion` builds choice distributions with the helper. Option rows come first (sorted by count, as today), then "Other". The CSV builder, `answerLabels`, the funnel and stats are unchanged.
- `src/utils/scriptSurveyGrid.ts`: `buildGridModel` uses the same rule, so `GRID_OTHER` holds exactly the unmatched answers (Spanish labels now count in their column).
- `src/utils/scriptSurveyRespondents.ts`: `respondentsForChoice` / `respondentsForGridCell` use the helper. `OTHER_LABEL` / `GRID_OTHER` return respondents with an unmatched label. New `unmatchedAnswerText(q, record)` returns the full unmatched text joined with "; ". `respondentsForTabItem` gets this automatically.
- `src/components/research-insights/script-survey/RespondentsSheet.tsx`: `RespondentsSelection` gets an optional `answerFor?: (r) => string | null`. When it is set, each row shows that text in muted, wrapping type. There are no labels about where the answer came from.
- `src/components/research-insights/ScriptSurveyInsightsDashboard.tsx` (QuestionTopicCard + grid click) and `script-survey/ScriptSurveyResponsesTab.tsx`: when "Other" is clicked, pass `answerFor`. In the tab, the Yes/No question also gets a third small "Other" box, shown only when its count is above 0. Today those boxes show only Yes and No.
- The printable report (`scriptSurveyReportExport.ts` via `toPEScriptData`) and the Word brief (`generate-script-survey-docx.ts`) pick up the new distribution unchanged. The Word brief stays anonymous and shows no answer text.
- Tests: extend `src/utils/scriptSurveyRespondents.test.ts` and `scriptSurveyRespondentsTab.test.ts`, and add `src/utils/scriptSurveyOptionMatch.test.ts`. They cover:
  - unmatched sentences going into "Other"
  - a Spanish label counting as its English option
  - multi-select with one matched and one unmatched label (counts in both rows, base unchanged)
  - Yes/No with an unmatched answer
  - grid Other
  - an older-format answer (`selected_options` string / `answer_text`)
  - single choice adding up to 100%
  - every panel count equalling its card count

Known existing behaviour: the shared donut chart on the Overview tab already merges very small slices into its own unclickable bucket. That stays as it is.

## Point 5 — other dashboards (left unchanged, evidence)
- **Payment Experience:** `src/utils/paymentExperienceScriptResponses.ts`. The question definitions (`PE_QUESTIONS`, around lines 30–50) have no `options` list. Yes/No is forced to the fixed `['yes','no']` entries (around line 565). `dues_day_stated` and `commitment_stated` use fixed `DAY_ORDER` / `COMMITMENT_ORDER`. Other multi-choice rows are named through fixed key-to-label maps (`labelFor`, around line 395). With no option list there is nothing to match against, so rule 1 ("questions without options are not touched") leaves it unchanged.
- **Audience:** `src/hooks/useAudienceSurveyResponses.ts` `aggregateArray` / `aggregateSingle` (around lines 66–95) count AI-extracted profile fields through `normalizeLabel`. They are not script questions and have no option list, so they stay unchanged.
- **Move-Out:** `src/components/moveout-insights/*` render the stored insight report (`ResearchInsightData` reason codes via `ReasonCodeChart`), not per-record answers, so they stay unchanged.

## Point 6 — kept as is
- **KPI tiles:** `src/config/scriptSurveyKpis.ts` `computeScriptKpis` reads `answerLabels` directly against each tile's fixed `positiveOptions`. They don't use the distributions, so no tile number changes and no tile depends on an unmatched label.
- **Also unchanged:** funnel, filters, AI summary, Submissions tab, CSV (raw answer text per question), Reports call panel (`useResearchCallAnswers`), Written answers, and AI clusters for open questions.

## Rules
- **R1:** identity via `callerIdentity` plus the existing masking.
- **R2:** the row is just "Other". There is no AI, free-text or source wording anywhere.
- **R3:** the only new read is one extra column from a table the user already reads.
- **R4:** nothing is logged, and "Open call" carries the booking id only.

## Verification
`tsgo --noEmit -p tsconfig.app.json`, all respondent and caller tests, then a click-through on Non-Booking "How did you first hear about PadSplit?" to confirm the panel count equals the card count.
