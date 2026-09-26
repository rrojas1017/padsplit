# CR-010 Phase 2 — Payment-Experience-style dashboard for per-script surveys

This phase builds a new dashboard for the two per-script surveys: 30-Day Member Experience (c24c5e6b…) and Non-Booking Conversion (827b23ef…). It looks like the Payment Experience (PE) dashboard. Every other script keeps today's panel.

## PE UI inventory and decisions

| PE piece | Props today | Decision |
|---|---|---|
| `KPI` tile (private, in `PaymentExperienceInsightsDashboard.tsx`) | `label, value, denominator?, meta?, caption?, icon, iconBg?, iconColor?, variant?, accent?` | **Move** it unchanged to `insights/primitives/KpiTile.tsx`. PE imports it from there, so PE's markup stays identical. The new dashboard reuses it. |
| `ExecutiveSummaryBanner` | `insight: PaymentAIInsight, kpis: PaymentKPIs, topFrictionThemes, firstAction?` (PE-typed) | **Twin**: `ScriptSurveySummaryBanner`, with the same markup, classes and icons. It takes `{ summary: string, firstAction?: string, chips: string[] }`. |
| `SurveyFunnelSection` | `steps: FunnelStep[], eligibility?: FunnelEligibilityMeta` (the meta has PE voicemail/short-call fields) | **Twin**: `ScriptSurveyFunnelSection`. Same markup, but the footer line is a `detail: string`. |
| `primitives/SectionHeader` | `title, hint?, emphasis?` | **Reuse as-is.** |
| `InsightTabs` | PE records and fixed PE tab keys | **Twin**: `ScriptSurveyTabs`. Same `TabsList` / `TRIGGER_CLASS` look, plus `flex-wrap` so the tab list wraps on narrow screens. |
| `TopicQuestionCard` | `summary: PEQuestionSummary, title, chart, helperText?, fixedOrder?, maxRows?, donutMinReadablePct?` | **Reuse as-is**, through an adapter that turns a script question summary into PE's summary shape (`toPEQuestionSummary`). |
| `OpenEndedClusters` | `questionId, questionText, responses, sampleResponses?, totalResponses?` | **Reuse as-is.** The `questionId` becomes `<scriptId>:<question.id>` so cached clusters never collide with PE's. |
| `tabs/ScriptResponsesTab` (uses private `StatCard`, `MultiBars`, `YesNoPills`, `ScaleDisplay`, `OpenEndedDisplay`, `QuestionCard`) | `eligibleRecords: PaymentExperienceRecord[], totalRouted` (derives PE data internally) | **Twin**: `ScriptSurveyResponsesTab`. It copies those private visuals with identical markup and feeds them adapted PE summaries. It adds a jump-to select, a "Download Report" button and a "CSV" button. |
| `paymentExperienceReportExport.openPaymentExperienceScriptReport` | `{ data: PEScriptData }`, with the "Payment Experience" title hardcoded | **Twin**: `scriptSurveyReportExport.openScriptSurveyReport({ scriptName, data })`, with the same HTML layout and CSS, titled with the script name. |

## New dashboard: `src/components/research-insights/ScriptSurveyInsightsDashboard.tsx` (`{ scriptId }`)

The dashboard is built on the Phase 1 pieces (`useScriptSurveyResponses`, `scriptSurveyAnalytics`, `scriptSurveyKpis`). All data is filtered by booking date through `filterByDateRange`. Top to bottom:

1. **Header row** (right-aligned, like PE's):
   - A date-range select with PE's 5 options, stored in `useSessionState('scriptSurvey:<scriptId>:dateRange', 'allTime')`.
   - A "Word" button that calls the existing `generateDynamicReport`. Its answers are built from the filtered eligible records: one entry per answered question, with `session_id` = booking id. Phase 3 replaces this button.
2. **Loading and empty states:**
   - A loading skeleton copied from PE.
   - "No survey calls processed yet." when there are no records.
3. **Summary banner:**
   - It reads the latest completed `research_insights` row for `campaign_type = script_<id8>` and shows `data.report.executive_summary`.
   - The first-action line is `recommendations[0].action`.
   - When there is no report, it shows a set line: "{respondents} members surveyed · {completionRate}% avg completion · lowest-scoring: {label} ({x.x}/5)".
4. **Six KPI tiles:** shared `KpiTile` in PE's grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3`), using `computeScriptKpis(config, questions, eligible, records.length)`.
   - Values: averages as `x.x/5`, percentages as `NN%`, counts as the number; "—" when empty.
   - Denominator text and style (`variant` / `accent`) as specified in the ticket.
5. **Survey Funnel:** a `SectionHeader` plus the funnel twin, from `computeScriptSurveyFunnel`.
   - It shows only when at least 2 steps are non-zero.
   - Detail line: "{valid} valid conversations of {routed} routed · {forms} with typed form · {recordingOnly} recording-only".
6. **Tabs:**
   - **Overview:** one `TopicQuestionCard` per question behind KPI tiles 2–6. Scale questions show as ordered bars (`fixedOrder` 1..max). Choice questions show as a donut, falling back to ranked bars under PE's readability rule (`donutMinReadablePct`).
   - **One tab per script section:**
     - Tabs follow script order; each label is at most 28 characters, ending in "…" when cut.
     - Choice and scale questions use `TopicQuestionCard`; open-ended questions use `OpenEndedClusters`.
   - **Script Responses:**
     - The responses twin: stat cards (Completion Rate, Avg Questions Answered, Respondents, Latest Response), the jump-to select and every question's visuals.
     - A "Download Report" button opens the report twin; a "CSV" button uses `buildScriptSurveyCsv`.
   - **Submissions:** `ScriptSubmissionsTab`, shown to super_admin and admin only (as today).
   - **AI Summary:** `ScriptAISummaryTab`, shown to super_admin, admin and supervisor. Only admins can generate (as today).

## Wiring

In `ScriptInsightsPanel.tsx`:
- `ScriptSubmissionsTab` and `ScriptAISummaryTab` get the `export` keyword; their bodies are unchanged.
- An early branch goes in before the panel renders: when `SCRIPT_SURVEY_KPIS[scriptId]` exists, it returns `<ScriptSurveyInsightsDashboard scriptId=… />`.
- The existing hooks are split into an inner `LegacyScriptInsightsPanel`, so the rules about React hook order hold. Its body moves as-is, so its output is identical.

`ResearchInsights.tsx` is not changed.

## Files touched

New:
- `src/components/payment-experience/insights/primitives/KpiTile.tsx` (the moved KPI tile)
- `src/components/research-insights/ScriptSurveyInsightsDashboard.tsx`
- `src/components/research-insights/script-survey/ScriptSurveySummaryBanner.tsx`
- `src/components/research-insights/script-survey/ScriptSurveyFunnelSection.tsx`
- `src/components/research-insights/script-survey/ScriptSurveyTabs.tsx`
- `src/components/research-insights/script-survey/ScriptSurveyResponsesTab.tsx`
- `src/utils/scriptSurveyReportExport.ts`
- `src/utils/scriptSurveyPEAdapter.ts`: `toPEQuestionSummary(question, summary)` and `toPEScriptData(...)`. It maps question types: `multiple_choice` becomes `multi`, `yes_no` becomes `yesno`, `scale` stays `scale`, `open_ended` becomes `open`. Distribution items get `key` = label.

Edited:
- `PaymentExperienceInsightsDashboard.tsx`: the local KPI tile is replaced by an import of the identical moved tile.
- `ScriptInsightsPanel.tsx`: the exports and the early branch described above.

## Must not change

- PE, Move-Out and Audience rendering and data.
- Edge functions, the database, types.ts.
- Role gating.
- No new dependencies.

## Verification

- `tsgo --noEmit -p tsconfig.app.json`.
- A diff check that the moved KPI tile's body is byte-identical to the original.
- Nothing published.
