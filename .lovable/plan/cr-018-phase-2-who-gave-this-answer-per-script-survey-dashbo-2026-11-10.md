# CR-018 phase 2 — Who gave this answer (per-script survey dashboards) + phase 1 fix

Frontend only. No database, migration, SQL, function, RLS or dependency change. Nothing published. Rules R1–R4 apply as written.

## A) Phase 1 fix — older answer format in the call panel
`src/hooks/useResearchCallAnswers.ts`: drop its private `answerText()` and use the dashboard's helpers from `src/utils/scriptSurveyAnalytics.ts` (`hasAnswerValue`, `answerLabels(e, q.options)`, `answerScale`, `answerText`). These already fall back to `selected_options` and `answer_text`. Small fix: `answerLabels` will also accept `selected_options` sent as a single string, a shape seen in older records. The dashboard counts may then match that shape too; no other logic changes.
- Answer string = labels joined ", " → else scale number → else text.
- "Has answers" = `hasAnswerValue` on any entry, which is the same rule the dashboard uses.

## B) Phase 2 — per-script dashboards only

### Data (`src/hooks/useScriptSurveyResponses.ts`)
- Add `member_name, contact_phone, agent_id` inside the existing `bookings!inner(...)` select. Nothing else in the query changes.
- `ScriptSurveyRecord` gains `member_name`, `contact_phone`, `agent_id`. Agent names come from the agents list the app already loads (`useAgents`), so no new join is needed.

### Shared respondent logic (new `src/utils/scriptSurveyRespondents.ts`, pure)
These helpers use the same normalization as the counts, so the number in a panel title always equals the count on the card:
- `respondentsForChoice(q, records, label)`: records where `answerLabels(e, q.options)` (else `answerText`, for single-choice and yes/no only) includes the label. Uses the same branches as `summarizeScriptQuestion`.
- `respondentsForScale(q, records, value)`: `Math.round(answerScale) === value`.
- `respondentsForGridCell(rowQ, records, column)`: same column matching as `buildGridModel`. Picking "Other" returns the labels that match no column.
- `openEndedAnswers(q, records)`: `{ record, text }` built by the same expression as `summarizeScriptQuestion`'s open-ended branch.
- Results are sorted newest first (`booking_date` desc, then booking id).
- Test file `src/utils/scriptSurveyRespondents.test.ts` (run with `bun test`): for each type, the respondent count equals the summary count, including a record stored in the older answer format.

### Respondents panel (new `src/components/research-insights/script-survey/RespondentsSheet.tsx`)
- Right-side Sheet. Title "N respondents — <answer label>" (grid: "<row> — <column>"), with the question text under it.
- Each row shows:
  - the `callerIdentity` primary in bold, with the secondary phone under it (masked via `shouldMaskContactInfo(role)` → `maskPhone`, exactly as Reports does)
  - call date, agent name
  - campaign name, only when the campaign filter is visible
  - list name, only when the list filter is visible (never the list code)
- Shows 50 rows, then a "Show more" button. "Open call" goes to `/reports?booking=<id>`.
- No source labels or badges, and nothing is logged.

### Click wiring (optional props only)
- `src/components/payment-experience/insights/TopicQuestionCard.tsx`: new optional `onItemClick?: (item) => void`.
  - When it's passed, bar rows and donut legend rows/slices become clickable buttons (keyboard accessible, pointer cursor). The grouped "Other" donut slice is not clickable.
  - When it's absent, the markup and behaviour are unchanged, so Payment Experience, Move-Out, Audience and the legacy panel see no change.
- `src/components/research-insights/ScriptGridCard.tsx` (used only by the per-script dashboard): new optional `onCellClick(rowQ, column)`. Segments become clickable when it's passed.
- `src/components/research-insights/ScriptSurveyInsightsDashboard.tsx`:
  - `QuestionTopicCard` passes `onItemClick` (choice, yes/no, multi-select, scale bars) and opens the sheet with respondents from the same filtered `eligible` records.
  - Grid cards pass `onCellClick`.
  - Passes `showCampaign`/`showList`, plus campaign and list name lookups, to the sheet.
  - Nothing else changes: KPIs, funnel, filters, AI summary and the Submissions tab stay as they are.
- Open-ended: `OpenEndedClusters` and its clustering function and prompt are unchanged. Cluster data has no booking link, so clusters stay as they are.

### Script Responses tab (`src/components/research-insights/script-survey/ScriptSurveyResponsesTab.tsx`, only used by this dashboard)
- For open-ended questions, a collapsible "Written answers" list (built with `openEndedAnswers`) appears under the existing clusters. Each answer shows the text, then a small muted, clickable line "identity · call date" that goes to `/reports?booking=<id>`.
- CSV: `buildScriptSurveyCsv` in `scriptSurveyAnalytics.ts` gets an optional `identity` option.
  - The tab passes it, adding "Customer" (identity primary) and "Phone" (formatted, masked when masking applies) after `booking_date`. Existing columns are unchanged.
  - The Word brief does not call it with identity, so it stays exactly as it is.

## Not changed
AI summary, Submissions tab, KPI tiles, funnel, filters, all numbers, the Word brief, clustering, Payment Experience/Move-Out/Audience dashboards, the legacy panel, Reports (apart from the shared helper fix in A), auth, routes.

## Checks
- `tsgo --noEmit -p tsconfig.app.json`
- `bun test` for `callerIdentity` and `scriptSurveyRespondents`
- An in-browser check, if a session can be signed in: click an answer and compare the sheet count with the card count, then use "Open call" to open the Reports panel.
