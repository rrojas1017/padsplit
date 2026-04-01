

# Overview Tab Redesign with Clustered Reason Codes

## What We're Building

Replacing the flat reason code bar chart with a two-level clustered donut chart system, keeping the existing Executive Summary and Emerging Patterns sections mostly as-is, and adding real member counts from `booking_transcriptions`.

## Files to Create

### 1. `src/utils/reason-code-mapping.ts` — Shared utility
- `mapToCluster(primaryReasonCode: string): string` — the exact mapping function provided
- `CLUSTER_COLORS` constant with the 7 color definitions
- `CLUSTER_ORDER` array for consistent sorting

### 2. `src/hooks/useReasonCodeCounts.ts` — Data hook
- Queries `booking_transcriptions` where `research_classification IS NOT NULL` and `research_campaign_type = 'move_out_survey'`
- Selects `research_classification->>'primary_reason_code'` plus `booking_id` for joining
- Groups results using `mapToCluster()` client-side
- Returns `{ clusters: ClusterData[], total: number, loading: boolean }`
- Each `ClusterData` includes: `name`, `count`, `percentage`, `color`, `subReasons: { name, count }[]`
- Sub-reasons with fewer than 3 records are grouped into "Other in this category"

## Files to Modify

### 3. `src/components/research-insights/ReasonCodeChart.tsx` — Full rewrite
Replace flat bar chart with two-level clustered view:

**Level 1 (default view):**
- Left side: Recharts `PieChart` donut (`innerRadius={60}`, `outerRadius={100}`) using real counts from `useReasonCodeCounts()`
- Center label: total count (e.g., "533 cases")
- On hover: cluster name + count + percentage tooltip
- Right side: 7 clickable cluster card rows showing colored dot, name, count, percentage, description (from `data.reason_code_distribution` matched by name), and arrow icon
- On click (either donut segment or card): transition to Level 2

**Level 2 (drill-down, replaces donut area):**
- "← Back to overview" button at top
- Header: cluster name + total count
- Smaller pie chart showing sub-reason breakdown within the cluster
- Table below: Sub-Reason | Count | % of Cluster | % of Total
- Member preview: first 5 members with Name, Phone, Sub-Reason, Score, Date
- "View all X members →" link that navigates to Member Data tab with cluster filter

**State management:**
- `expandedCluster: string | null` controls which level is shown
- Merges report-level descriptions from `data.reason_code_distribution` with real counts from hook

**Props change:**
- Keep `data` prop for descriptions from report
- Add internal `useReasonCodeCounts()` call for real numbers
- Keep `onCodeClick` prop for parent-level drill-down integration

### 4. `src/pages/research/ResearchInsights.tsx` — Minor update (lines 504-518)
- Update Overview tab to pass additional context to `ReasonCodeChart`
- Wire up "View all members" link to switch tab to `members` with a filter param

### 5. `src/components/research-insights/ExecutiveSummary.tsx` — No changes needed
Already correctly displays headline (first sentence), stat badges, key findings, and recommendations.

### 6. `src/components/research-insights/EmergingPatternsPanel.tsx` — No changes needed
Already renders patterns with title, description, status badges, and quotes.

## Technical Details

- The donut chart uses Recharts `PieChart` + `Pie` with `Cell` for colors — same library already in use
- Real counts come from a single Supabase query: `select research_classification from booking_transcriptions where research_classification is not null and research_campaign_type = 'move_out_survey'`
- Client-side grouping avoids complex SQL and handles LLM output drift via fuzzy keyword matching
- Member preview in Level 2 queries `booking_transcriptions` joined with `bookings` filtered by the sub-reason codes in the cluster
- No database migrations needed

