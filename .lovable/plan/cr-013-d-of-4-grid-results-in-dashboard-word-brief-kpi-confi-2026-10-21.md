# CR-013 (D of 4) — Grid results in dashboard + Word brief, KPI config for Member Screening

Frontend only. No edge functions, migrations, RLS, database, new dependencies or publishing.

## Facts checked before planning
- `ScriptInsightsPanel` picks `ScriptSurveyInsightsDashboard` only when `SCRIPT_SURVEY_KPIS[scriptId]` exists; otherwise the legacy panel. That is the only gate.
- Research Insights script list: script `247ead24…` is active, slug empty, campaign_type `satisfaction`. The hide rules filter slug `satisfaction` (not campaign_type), `payment_experience` campaign type and one fixed id — so this script is listed and not hidden. No route/role change needed.
- The script currently has 39 questions and **no `matrix` on any question** (the `willing_*` and `helpfulness_*` rows are plain multiple_choice). So it will show per-row cards until someone converts those rows into a grid in the Script Builder. All six KPI hints exist with the expected types/options (`host_requested_cancellation_frequency` options use en dashes, matching the config).
- `useScriptSurveyResponses` maps questions field-by-field and drops `matrix`; `ScriptSurveyQuestion` has no `matrix` field.

## 1. Data layer
- `src/hooks/useScriptSurveyResponses.ts`: add `matrix?: { group; title; row }` to `ScriptSurveyQuestion` and pass `q.matrix` through in the mapping.
- New pure helper `src/utils/scriptSurveyGrid.ts`:
  - `groupSurveyBlocks(questions)` → list of `{ kind: 'single', q }` or `{ kind: 'grid', group, title, rows }`, using `getMatrixBlock` / `isValidMatrixRow` from `scriptMatrix.ts`. A block becomes a grid only if every row is a valid matrix row; otherwise each row stays single.
  - `buildGridModel(block, eligible)` → `{ title, columns, rows: [{ id, label, n, segments: [{ label, count, pct }] }], hasOther }`. Columns = first row's `options`. Each row uses `summarizeScriptQuestion`; counts matching a column (case-insensitive) go to that column, the rest go to "Other" (added only when present). pct = count / row n × 100. Rows in script order.

## 2. Dashboard grid card
- New `src/components/research-insights/ScriptGridCard.tsx`: title, a column legend once at the top, one line per row: row label, 100%-stacked horizontal bar (segment text hidden under 6%), "n = X". Colours: one semantic token ramp (strongest → weakest, e.g. primary at decreasing opacity), "Other" in muted. No hardcoded colours.
- `ScriptSurveyInsightsDashboard.tsx`: Overview and each section tab render from `groupSurveyBlocks` — grid block → `ScriptGridCard` (full width), single → existing `QuestionTopicCard` unchanged. Overview stays KPI-driven: a grid shows there only if one of its rows is a KPI question.
- Responses tab and CSV unchanged (per row).

## 3. Word brief
- `src/utils/generate-script-survey-docx.ts`: section loops iterate `groupSurveyBlocks`. Grid block → one heading (`matrix.title`) and one table: Row | each column "n (pct%)" | "n answered" (plus "Other" column only if present). Rows in script order. Single questions unchanged. Factor the grid table into an exported `buildGridDocxTable(model)` so it can be checked without generating a file.

## 4. KPI config
`src/config/scriptSurveyKpis.ts`, new entry `247ead24-6b86-4b19-b352-0493c1831ba9`:
1. `surveyed`
2. avg5 "Approval Clarity" — `approval_clarity`, ShieldCheck
3. avg5 "Trust in Screening" — `trust_in_screening`, ShieldAlert-free choice: `Shield` (lucide)
4. pct "Host Extra Screening" — `host_secondary_screening_requested`, positive `["Yes, one host", "Yes, every time I submitted a booking"]`, UserCheck, primary, orange, 'X of Y answered'
5. pct "Host-Requested Cancellations" — `host_requested_cancellation_frequency`, positive `["Once", "2–3 times", "4+ times"]`, CalendarX, primary, orange, 'X of Y answered'
6. avg5 "Overall CSAT" — `overall_csat`, Star, primary, green

Plus `SCRIPT_SURVEY_PURPOSE['247ead24…']` with the exact text given.

## 5. Not touched
Agent runners, builders, edge functions, database, other scripts' configs, PE / Audience / Move-out dashboards.

## Acceptance (confirmed after build)
- tsgo clean.
- 30-Day and Non-Booking (no matrix) render identically: `groupSurveyBlocks` returns only singles in original order.
- Throwaway bun check in /tmp (project has no test runner configured): 3-row × Yes/Maybe/No grid with sample respondents → one grid block, per-row percentages correct and each row sums to 100%; one stray label produces an "Other" segment; `buildGridDocxTable` returns one table with header + 3 rows.
- Member Screening opens the new dashboard with the six KPI tiles.
- Nothing published.

## Files
- `src/hooks/useScriptSurveyResponses.ts`
- `src/utils/scriptSurveyGrid.ts` (new)
- `src/components/research-insights/ScriptGridCard.tsx` (new)
- `src/components/research-insights/ScriptSurveyInsightsDashboard.tsx`
- `src/utils/generate-script-survey-docx.ts`
- `src/config/scriptSurveyKpis.ts`
