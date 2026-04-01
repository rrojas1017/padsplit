

# Add Sub-Categories to Addressability Drill-Down

## What changes
Currently, clicking an Addressability bucket (e.g. "Addressable") shows which reason clusters are inside it (Host Negligence, Payment Friction, etc.) but no further granularity. We'll add sub-reason breakdown within each cluster — mirroring the Reason Code drill-down experience.

## Technical approach

### 1. `src/hooks/useAddressabilityBreakdown.ts` — Add sub-reason data
- Import `extractSubReason` from the shared mapping utility
- Also read `case_brief` from `research_classification` in the loop
- Extend `ReasonInBucket` to include a `subReasons` array (name + count)
- Within each addressability bucket → cluster grouping, extract sub-reasons via keyword matching on `case_brief`
- Group sub-reasons with < 3 records into "Other in this category"

### 2. `src/components/research-insights/ReasonCodeChart.tsx` — Enhance `AddressabilityDrillDown`
- Add expandable rows in the cluster table: clicking a cluster row expands to show its sub-reasons (indented rows with smaller text)
- Use a `expandedClusterInBucket` state to track which cluster is expanded
- Show sub-reason counts and percentage within the cluster
- Keep the existing pie chart, member preview, and MemberDetailPanel

### Files
| File | Action |
|------|--------|
| `src/hooks/useAddressabilityBreakdown.ts` | Add sub-reason extraction per cluster |
| `src/components/research-insights/ReasonCodeChart.tsx` | Add expandable sub-reason rows in AddressabilityDrillDown |

