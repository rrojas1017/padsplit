# CR-018 phase 2b — "Who gave this answer" inside the Script Responses tab

Frontend only. No database, migration, SQL, function, RLS or dependency change. Nothing published.

## What the user will see
On the 30-Day, Non-Booking and Member Screening dashboards, in **Script Responses**, every answer row, Yes/No pill, scale bar and grid-row answer becomes clickable (pointer, hover highlight, focusable, Enter/Space). Clicking opens the **same** right-side "N respondents — <answer>" panel the Overview/topic tabs already use, with the question text underneath. Grid rows are titled "<row> — <column>". Everything else in the tab is unchanged.

## How the counts are guaranteed to match
The tab's cards come from `summarizeScriptQuestion` (via `toPEScriptData`), which counts **exact** labels (no case merging on this tab). So each clicked item resolves with the existing helpers over the same `eligibleRecords`:

| Card type in tab | Clicked item | Helper |
|---|---|---|
| multiple_choice / multiple_select (MultiBars) | row label | `respondentsForChoice(q, eligible, label)` |
| yes_no (pills) | the distribution item the pill displays (`key === 'yes'/'no'`, first match — same item whose count is shown) | `respondentsForChoice` with that item's label |
| scale (ScaleDisplay bars, incl. zero bars disabled) | bucket value | `respondentsForScale(q, eligible, Number(label))` |
| compound sub-questions | same as above per sub type | same |
| grid rows (rendered as one card per row question with `matrix`) | column label | `respondentsForChoice(rowQ, eligible, label)`; title "<matrix.row> — <label>" |
| open-ended | not changed (Written answers list stays) | — |

Labels that differ only by case are unioned (dedupe by booking id, newest first) exactly like the dashboard's QuestionTopicCard; since this tab lists exact labels, the union equals the displayed row. No grouped "Other" bucket exists on this tab, so nothing is excluded. Zero-count items are not clickable.

## Single shared panel
The dashboard already owns `respSel` + one `<RespondentsSheet>` with the campaign/list name lookups (shown only when those filters are visible, names only, never the list code). I pass an optional `onSelect={setRespSel}` into `ScriptSurveyResponsesTab`; no second panel is created. Payment Experience / Move-Out / Audience do not render this tab and get nothing new.

## Files
- `src/utils/scriptSurveyRespondents.ts` — add one pure helper `respondentsForTabItem(q, eligible, item)` that picks the right existing helper per question type and unions case-variant labels (shared by the tab and the test). Existing helpers untouched.
- `src/components/research-insights/script-survey/ScriptSurveyResponsesTab.tsx` — optional `onSelect` prop; `MultiBars`, `YesNoPills`, `ScaleDisplay` and compound subs get an optional `onItem` callback rendering rows/pills/bars as `<button type="button">` with hover/focus styles; `QuestionCard` builds the selection (title, question text, records). Charts, order, highlight, AI clusters, Written answers, Download Report, CSV (Customer/Phone), printable report unchanged.
- `src/components/research-insights/ScriptSurveyInsightsDashboard.tsx` — pass `onSelect={setRespSel}` to the tab (one line).
- `src/utils/scriptSurveyRespondentsTab.test.ts` — new: for each type (multiple_choice, multiple_select, yes_no, scale, grid row, compound sub) builds records, runs `summarizeScriptQuestion` → `toPEQuestionSummary`, and asserts every displayed item's count equals `respondentsForTabItem(...).length`; includes an older-format record (map-keyed entry with `selected_options` string / `answer_text`, no `question_id`).

## Rules kept
R1 identity via existing `useRecordIdentity` (callerIdentity + masking) inside RespondentsSheet. R2 no source labels added. R3 only already-loaded records; no new reads/RPC. R4 nothing logged; "Open call" carries booking id only. Word brief, KPIs, funnel, filters, numbers, AI summary, Submissions unchanged.

## Verification
`tsgo --noEmit -p tsconfig.app.json`; run the respondents test files; Playwright click-through on one script's Script Responses tab confirming panel count equals card count.
