

# Rebuild Move-Out Research Insights — New Component Tree

## Strategy
Create 7 new files in `src/components/moveout-insights/` and wire them into `ResearchInsights.tsx`. The old `research-insights/` folder stays untouched. All existing hooks and data layer remain unchanged. Audience Survey view is not affected.

## New Files

### 1. `src/components/moveout-insights/utils.ts`
- `formatPercent(value)` — handles null, decimals 0-1, already-percentage strings, ranges like "60-70%"
- `stripUUIDs(text)` — removes UUIDs, parenthesized IDs, collapses whitespace
- `formatCount(count, total?)` — "X of Y records" or "X cases"
- `parseSeverityLevel(severity)` — extracts P0/P1/P2 from severity strings, returns priority + color classes

### 2. `src/components/moveout-insights/MoveOutKPIGrid.tsx`
- Props: `{ kpis: ExtendedKPIs }` (reuse existing `ExtendedKPIs` type from InsightsKPIRow)
- 3×2 responsive grid (grid-cols-3 → 2 → 1)
- Cards: Total Cases, Addressable %, Top Reason, Host Related %, High Regret %, Payment Related %
- Each card: icon in colored circle, hero number (text-3xl), label, context line
- All percentages through `formatPercent()`. No trends/deltas/sparklines.
- Top Reason shows full name with `text-xl` fallback for long names

### 3. `src/components/moveout-insights/MoveOutOverview.tsx`
- Props: `{ reportData: ResearchInsightData; kpis: ExtendedKPIs; lastUpdated: string | null; totalRecords: number }`
- **AI Executive Summary card**: dark bg-slate-900 card, parsed headline (first sentence bold), body findings, "Generated from X cases · Last updated" footer. No stat pills.
- **Two donuts side-by-side**: Delegates to existing `ReasonCodeChart` component (it already works well with donut + treemap + drill-down). Pass through props.
- **Emerging Patterns**: Renders `MoveOutPatterns` component below charts

### 4. `src/components/moveout-insights/MoveOutPatterns.tsx`
- Props: `{ data: EmergingPattern[] }`
- `stripUUIDs()` applied to ALL pattern text and descriptions
- Show top 5 by default (sorted by frequency/case count desc)
- Each card: bold title (single line, truncated), 2-line description with `line-clamp-2`, "Show details" toggle, case count badge, severity badge (Act Now=red, Investigate=amber, Monitor=blue)
- "Show all X patterns" expansion button
- Compact cards: `bg-white rounded-lg border p-4`, left border colored by severity

### 5. `src/components/moveout-insights/MoveOutIssuesTab.tsx`
- Props: `{ reportData: ResearchInsightData }`
- Renders existing `IssueClustersPanel` (it works), `TopActionsTable`, and `BlindSpotsPanel` — these components are functional, so we reuse them directly
- Wraps them in a clean `space-y-4` layout
- Shows "No data available" message if all three sections are empty

### 6. `src/components/moveout-insights/MoveOutOperationsTab.tsx`
- Props: `{ reportData: ResearchInsightData }`
- **Host Accountability Flags**: Render as a sortable table (not cards) with columns: Flag description, Severity (with priority badge), sorted by severity level. Show first 10, expand to all.
- **Payment/Transfer Friction**: Reuse existing `PaymentFrictionCard` and `TransferFrictionCard` in a 2-col grid — they work fine
- **Agent Performance**: Reuse existing `AgentPerformanceCard`
- Empty state: "No data available" instead of skeleton cards

### 7. `src/components/moveout-insights/MoveOutMemberTab.tsx`
- Simply renders the existing `MemberDataTab` component (it already has search, filters, pagination, drill-down)
- Thin wrapper that passes `isAdmin` prop

### 8. `src/pages/research/ResearchInsights.tsx` — Modifications
- Import new components from `moveout-insights/`
- In the move-out report content section (lines 462-568), replace existing component renders with:
  - `MoveOutKPIGrid` instead of `InsightsKPIRow`
  - `MoveOutOverview` in the overview tab instead of direct `ReasonCodeChart` + `EmergingPatternsPanel`
  - `MoveOutIssuesTab` in the issues tab instead of inline `IssueClustersPanel` + `TopActionsTable` + `BlindSpotsPanel`
  - `MoveOutOperationsTab` in the operations tab instead of inline `HostAccountabilityPanel` + friction cards + `AgentPerformanceCard`
  - `MoveOutMemberTab` in the members tab instead of direct `MemberDataTab`
- Keep `ExecutiveSummary` rendering but move it into `MoveOutOverview`
- Keep the command bar, progress banner, collapsible review queue, drill-down modal, and all dialogs as-is (they work)
- Remove old component imports that are no longer directly used in this file

## Key Decisions
- **Reuse working components**: `ReasonCodeChart`, `IssueClustersPanel`, `TopActionsTable`, `BlindSpotsPanel`, `PaymentFrictionCard`, `TransferFrictionCard`, `AgentPerformanceCard`, `MemberDataTab` all function correctly. The new wrapper components compose them with proper layout and empty-state handling rather than rewriting from scratch.
- **New implementations**: Only `MoveOutKPIGrid`, `MoveOutPatterns`, and the AI summary card in `MoveOutOverview` are truly new — these replace the broken/messy versions.
- **Host Accountability**: The existing panel renders cards. The new `MoveOutOperationsTab` re-implements this as a table for better density (flag text + severity in rows).

## Files Summary
| File | Action |
|------|--------|
| `src/components/moveout-insights/utils.ts` | Create |
| `src/components/moveout-insights/MoveOutKPIGrid.tsx` | Create |
| `src/components/moveout-insights/MoveOutOverview.tsx` | Create |
| `src/components/moveout-insights/MoveOutPatterns.tsx` | Create |
| `src/components/moveout-insights/MoveOutIssuesTab.tsx` | Create |
| `src/components/moveout-insights/MoveOutOperationsTab.tsx` | Create |
| `src/components/moveout-insights/MoveOutMemberTab.tsx` | Create |
| `src/pages/research/ResearchInsights.tsx` | Modify — swap to new components for move-out view |

