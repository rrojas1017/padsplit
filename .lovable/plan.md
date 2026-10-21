# CR-013 (B of 4) — Frontend: multi-select questions + legacy AI answer fallback

Frontend only. No `supabase/functions/*`, migrations, RLS or database. No new dependencies. Grids are not part of this prompt.

## Files touched (14)
1. `src/hooks/useResearchScripts.ts`
2. `src/components/research/ResearchScriptDialog.tsx`
3. `src/components/script-builder/QuestionCard.tsx` (the wizard's question card used by `StepQuestions`)
4. `src/components/script-builder/StepUpload.tsx` (keeps `options` / `max_selections` when saving)
5. `src/pages/PublicScriptView.tsx`
6. `src/components/research/ScriptTesterDialog.tsx`
7. `src/components/script-builder/StepPreview.tsx`
8. `src/utils/scriptSurveyAnalytics.ts`
9. `src/utils/scriptSurveyPEAdapter.ts`
10. `src/components/research-insights/ScriptSurveyInsightsDashboard.tsx`
11. `src/utils/generate-script-survey-docx.ts`
12. `src/components/research/DynamicQuestionCard.tsx`
13. `src/utils/generateDynamicReport.ts` (only the `scale`/`open_ended` checks are typed; it just needs to compile — see D)
14. `src/components/script-builder/StepAIPrompt.tsx` (lists options for `multiple_select` the same way it does for multiple choice)

`src/utils/scriptBranching.ts` needs **no change**. `resolveNextQuestionIndex` only branches for `yes_no`, `scale` and `multiple_choice`. Any other type, including `multiple_select` with an array answer, falls through to the next question, and the whole function is wrapped in try/catch.

## A. Type
- `ScriptQuestion.type` gains `'multiple_select'`, and `ScriptQuestion` gets an optional `max_selections?: number`.
- `ScriptSurveyQuestion` (in `useScriptSurveyResponses`) inherits the new type automatically.

## B. Script Builder (both editors)
- The type picker gets "Multiple select (select all that apply)".
- The options editor is the same one multiple choice uses (same markup, shown for both types).
- New optional "Max selections" number input (same `Input` style), shown only for multiple select:
  - empty = no limit;
  - accepted values are whole numbers from 2 to the number of options;
  - anything else is stored as no limit (`max_selections` removed), and the field shows a small hint.
- Branching controls are hidden for this type (it isn't in the set of types that can branch).
- Changing the type:
  - multiple choice → multiple select keeps `options` and deletes `branch.option_gotos`;
  - multiple select → multiple choice keeps `options` and removes `max_selections`;
  - switching to any other type works as it does today.
- Saving (`ResearchScriptDialog` save mapping, `StepUpload`) keeps `options` when the type is `multiple_choice` or `multiple_select`, and keeps `max_selections` only for `multiple_select`.

## C. Agent form (PublicScriptView, ScriptTesterDialog, StepPreview)
- `multiple_select` shows one checkbox per option, using the same row container classes as the existing radio rows and the existing `Checkbox` component.
- Helper line above the rows: "Select all that apply", or "Select up to N" when `max_selections` is set.
- When the limit is reached, the boxes that aren't ticked are disabled.
- Spanish: labels come from that question's `questions_es` options (the same lookup multiple choice uses). The stored value is the label as displayed, matching how multiple choice is stored today.
- The answer is saved under the question's stable key as `string[]`. Unticking the last box removes the key from responses.
- "Next" counts the question as answered when the array is non-empty, then moves to the next question.
- The save queue, snapshot, dialer params, CR-012 outcomes and the other question types stay as they are.

## D. Analytics
### Legacy AI answer fallback (`scriptSurveyAnalytics.ts`)
- `hasAnswerValue(e)` also counts a non-empty `selected_options` array or non-empty `answer_text`.
- `answerLabels(e, options?)`:
  - returns `selected_option_labels` when present;
  - otherwise falls back to `selected_options`;
  - when `options` is given, the fallback keeps only values that match an option case-insensitively, returns the option's own text and drops duplicates.
- `answerText(e)`: `raw_text_answer`, otherwise `answer_text`.
- Scale is unchanged. Typed answers keep priority because they already carry the new fields.
- `summarizeScriptQuestion` and `cellValue` pass the question's `options`.

### Multi-select summary
- `summarizeScriptQuestion` gets a new summary type `multiple_select`:
  - count each selected option once per respondent;
  - `count` = respondents who answered;
  - `pct` = option count ÷ respondents who answered (totals can exceed 100%);
  - options nobody picked are listed with 0.
- Multiple choice, yes/no, scale and open-ended stay as they are. Today's multiple-choice `pct` already uses the respondent count.

### Dashboard cards
- `scriptSurveyPEAdapter`: `multiple_select` maps to `'multi'` and keeps its counts and percentages unchanged.
- `ScriptSurveyInsightsDashboard`: a `multiple_select` question renders `TopicQuestionCard` with `chart="bars"` and `helperText="Multiple answers allowed — % of respondents"` instead of the donut.

### Responses tab and CSV
- `cellValue` already joins labels with "; ", so no change is needed beyond passing `options`.

### Word brief
- `generate-script-survey-docx`: `multiple_select` uses the existing Answer / Count / % table, with a note paragraph "% of respondents; multiple answers allowed".

### Legacy panel
- `DynamicQuestionCard`:
  - `TYPE_LABELS` gains "Multiple Select";
  - the chart block that today checks `multiple_choice` also renders for `multiple_select`;
  - counting already goes through the default branch, once per value in `response_options`.
- `generateDynamicReport.finding` already counts every value in `response_options` for non-scale, non-open types, so no logic change is needed there.

## E. Not touched
`LogSurveyCall`, PE / Audience / Move-out dashboards, routes, roles, KPI configs, `CallOutcomesEditor`, `ResearchScriptImportDialog`, `useResearchCalls`, `rawScriptAnswers.ts`.

## Side effects and items I couldn't map
- The legacy fallback also feeds the KPI tiles, because `scriptSurveyKpis.computeScriptKpis` calls `answerLabels` without options. The config isn't edited, but KPI tiles, answered counts and the funnel ("Answered ≥1 / ≥50% / all") on 30-Day and Non-Booking will rise once old recording answers are counted. Without options, the KPI path uses the raw `selected_options` values as the AI wrote them; KPIs match exact labels, so non-canonical values stay uncounted there.
- Legacy-panel data (`script_responses.response_options`) is written by code outside this prompt. Whether a multi-select answer actually reaches that table depends on the writer; the panel only gets its reading side here.
- `ResearchScriptImportDialog` doesn't know about `multiple_select` (out of scope), so imported scripts can't create this type yet.

## Verification
- `tsgo --noEmit -p tsconfig.app.json` clean.
- Nothing published, and no real survey submitted.
