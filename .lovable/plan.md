
# Refactor Payment Experience Tabs into Survey Topic Tabs

Replace the four analytical tabs (Overview, Drivers & Friction, Segments, Actions) below the persistent dashboard tiles with topic tabs aligned to the underlying survey questions. The existing Script Responses tab stays untouched and remains the final tab.

## Final tab order

1. Overview
2. Payment Schedule
3. Method of Payment
4. Autopay
5. Sentiment / Frustration
6. Payment Options
7. Script Responses (unchanged)

## Files

**Edit**
- `src/components/payment-experience/insights/InsightTabs.tsx` — swap tab triggers/content, update `TabKey`, drop unused props passed to old tabs (KPIs, drivers, segments, actions, friction summary, autopay barriers, etc.). Keep underline styling and overflow scroll. Pass `eligibleRecords` (and `totalRouted` where needed) into the new topic tabs and existing Script Responses tab.

**Create** (new topic tabs)
- `src/components/payment-experience/insights/tabs/PaymentExperienceOverviewTab.tsx`
- `src/components/payment-experience/insights/tabs/PaymentScheduleTab.tsx`
- `src/components/payment-experience/insights/tabs/MethodOfPaymentTab.tsx`
- `src/components/payment-experience/insights/tabs/AutopayTab.tsx`
- `src/components/payment-experience/insights/tabs/SentimentFrustrationTab.tsx`
- `src/components/payment-experience/insights/tabs/PaymentOptionsTab.tsx`

**Create** (shared)
- `src/components/payment-experience/insights/ScriptQuestionGraphCard.tsx` — extracted reusable card that renders a single `PEQuestionSummary` using the existing visual grammar (`MultiBars`, `YesNoPills`, `ScaleDisplay`, `OpenEndedDisplay`, footer line). Source rendering primitives are duplicated from `ScriptResponsesTab.tsx` so that file is not modified. Accepts `summary`, `total`, and an optional `compact` prop that hides the footer/section badge for the Overview grid.

**Do NOT touch**
- `src/components/payment-experience/insights/tabs/ScriptResponsesTab.tsx`
- `src/utils/paymentExperienceScriptResponses.ts`
- `src/utils/paymentExperienceReportExport.ts`
- Executive Summary, KPI Grid, Survey Funnel components
- The old tab files (`OverviewTab.tsx`, `DriversTab.tsx`, `SegmentsTab.tsx`, `ActionsTab.tsx`) — leave them on disk; they simply become unimported.

## Data flow

Each topic tab receives `eligibleRecords` and calls `derivePaymentExperienceScriptData(eligibleRecords, totalRouted)` once via `useMemo`, then picks the relevant `PEQuestionSummary` by `question.id` (or `question.order`):

- Overview → orders 2, 7, 8, 15 in a 2-col grid (`md:grid-cols-2`, single col on mobile), `compact` mode.
- Payment Schedule → orders 1, 2, stacked.
- Method of Payment → order 7.
- Autopay → orders 8, 9, stacked.
- Sentiment / Frustration → order 11. Since Q11 is typed `multi` (friction theme buckets) in `PE_QUESTIONS`, the tab shows the existing horizontal-bar theme distribution at top, then a verbatims block built from `friction_verbatim` / `friction_examples` strings on eligible records (capped at 25, collapsed by default — same `OpenEndedDisplay` pattern).
- Payment Options → order 15.

No new queries, no formula changes, no new charts.

## Visual & responsive

- Cards use the same `Card` + `CardContent` + spacing as existing question cards.
- Bars: muted gray; yes/no: amber-50/border + slate; scale: foreground bars with amber modal; open: collapsible verbatim list.
- Mobile (≤414px): tabs scroll horizontally (existing `overflow-x-auto`), cards stack, bar rows wrap labels, yes/no pills stack via `flex-col sm:flex-row`.

## Acceptance check

- Tabs below the persistent dashboard switch to the new topic set with Script Responses last.
- Overview shows compact graphs for Q2/Q7/Q8/Q15.
- Each topic tab renders the specified questions with Script-Responses visual parity.
- Script Responses tab behavior, dropdown, and report/CSV exports unchanged.
- No TS errors; persistent top dashboard untouched.
