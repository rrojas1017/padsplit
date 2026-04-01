

# Add Sub-Category Clustering Within Reason Code Drill-Downs

## Problem
After reclassification, every record's `primary_reason_code` is one of the 7 clean cluster names (e.g. "Host Negligence / Property Condition"). So when you drill down, the sub-reason pie chart shows a single 100% slice — no granularity.

The actual granular data exists in `reason_detail` (e.g. "mold and pest infestation", "host unresponsive to repairs", "rent increase too high"). We need to group by `reason_detail` instead.

## Changes

### 1. `src/hooks/useReasonCodeCounts.ts` — Group by `reason_detail`
- After mapping each record to its cluster via `primary_reason_code`, use `reason_detail` (falling back to `primary_reason_code`) as the sub-reason key
- This populates `subReasons` with granular entries like "mold issues", "pest infestation", "host unresponsive"
- Keep the existing logic that groups sub-reasons with < 3 records into "Other in this category"

### 2. `src/components/research-insights/ReasonCodeChart.tsx` — Fix member preview matching
- In `ReasonDrillDown`, the member preview filter currently matches on `primary_reason_code` against sub-reason names. Since sub-reasons are now `reason_detail` values, update the matching to compare against `reason_detail` instead
- Update the member preview "Sub-Reason" column to show `reason_detail` rather than `primary_reason_code`

## Technical Detail
The classification JSON stored in `research_classification` has this structure:
```json
{
  "primary_reason_code": "Host Negligence / Property Condition",
  "reason_detail": "mold and pest infestation",
  ...
}
```
Currently `useReasonCodeCounts` groups by `primary_reason_code` → 1 sub-reason per cluster. Switching to `reason_detail` gives meaningful sub-categories.

## Files
| File | Action |
|------|--------|
| `src/hooks/useReasonCodeCounts.ts` | Use `reason_detail` for sub-reason grouping |
| `src/components/research-insights/ReasonCodeChart.tsx` | Fix member preview to match on `reason_detail` |

