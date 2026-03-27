

## Implement Research Insights Redesign

All 7 steps from the spec, implemented in a single pass. No backend changes.

### New Files

**1. `src/types/research-insights.ts`**
Shared type definitions: `ResearchInsightData`, `ExecutiveSummary`, `ReasonCodeItem`, `IssueCluster`, `TopAction`, `FrictionAnalysis`, `BlindSpot`, `HostAccountabilityFlag`, `AgentPerformanceSummary`, `EmergingPattern`, `InsightProgress`, `ProcessingStats`, plus `deriveKPIs()` helper. Exact interfaces as specified.

**2. `src/components/research-insights/InsightsKPIRow.tsx`**
5 stat cards in a responsive grid (2→3→5 cols). Cards: Total Cases, Preventable %, Top Reason Code, Flagged for Review, Avg Preventability. Color-coded thresholds (red/amber/green). Icons from lucide-react.

**3. `src/components/research-insights/TopActionsTable.tsx`**
Compact table replacing TopActionsPanel. Handles both grouped object format (`p0_immediate_risk_mitigation`, `p1_systemic_process_redesign`, `quick_wins`) and flat array format. Rows grouped by priority with colored left borders. Columns: Priority, Action, Owner, Effort, Impact.

### Modified Files

**4. `src/components/research-insights/ReasonCodeChart.tsx`**
- `DEFAULT_VISIBLE = 8` constant, toggle between top 8 and all
- Detail cards hidden behind "Show category details" toggle (collapsed by default)
- New `onCodeClick?: (code: string) => void` prop for external drill-down control
- Internal `ReasonCodeDrillDown` still works as fallback when no `onCodeClick` provided

**5. `src/components/research-insights/IssueClustersPanel.tsx`**
- New `maxVisible?: number` prop
- When set, caps displayed clusters with "Show all N clusters" toggle button

**6. `src/pages/research/ResearchInsights.tsx`** (full rewrite)
- Controls bar, processing stats banner, generation progress banner — preserved as-is
- New `InsightsKPIRow` below progress, shown when `reportData` exists
- 3-tab layout using `@/components/ui/tabs`: Dashboard, Analysis, Operations
- Tab state synced with URL via `useSearchParams` (`?tab=dashboard|analysis|operations`)
- Dashboard tab: ExecutiveSummary + TopActionsTable
- Analysis tab: ReasonCodeChart (with `onCodeClick`) + IssueClustersPanel (`maxVisible={5}`) + EmergingPatternsPanel + BlindSpotsPanel
- Operations tab: HostAccountabilityPanel + PaymentFrictionCard/TransferFrictionCard (2-col grid) + AgentPerformanceCard
- Collapsible footer: HumanReviewQueue + ProcessedRecordsList (both closed by default, showing count badges)
- ReasonCodeDrillDown modal triggered by `drillDownCode` state

**7. `src/components/research-insights/TopActionsPanel.tsx`**
- Add `@deprecated` comment pointing to TopActionsTable. File kept for backward compatibility.

### What stays unchanged
ExecutiveSummary, PaymentFrictionCard, TransferFrictionCard, BlindSpotsPanel, HostAccountabilityPanel, AgentPerformanceCard, EmergingPatternsPanel, HumanReviewQueue, ProcessedRecordsList, ReasonCodeDrillDown, PriorityBadge, all hooks, no backend changes.

### Technical Notes
- `reportData` cast as `ResearchInsightData` instead of `any`
- `deriveKPIs(reportData, stats)` computes KPI values from report data with fallbacks
- Both data formats (grouped object and flat array) handled defensively in TopActionsTable and ReasonCodeChart
- Tab default is "dashboard" when no `?tab` param present

