
# Fix Pain Point Evolution Graph and Table Accuracy

## Problems Identified

1. **Mixed analysis scopes**: The evolution hook fetches ALL completed analyses regardless of their `analysis_period` (allTime, thisWeek, last7days, manual, etc.) and dumps them into the same monthly buckets. An "allTime" analysis covering 2 years has very different frequency distributions than a "thisWeek" analysis covering 7 days -- but both land in the same Feb 2026 bucket and get averaged together, distorting the graph.

2. **Time filter doesn't match table data**: Selecting "Last 6 months" only filters by `date_range_end` cutoff, but still mixes all analysis types. The table may show "firstSeen" / "lastSeen" from different analysis scopes, not reflecting actual temporal evolution.

3. **Graph doesn't reflect improvements**: When you run a recent analysis showing a pain point improved, it gets averaged with older "allTime" analyses that still show the higher historical number, masking the improvement.

## Solution

Filter the evolution data to only use **"allTime" analyses** as the consistent baseline. Each "allTime" analysis represents the full dataset snapshot at that point in time, making comparisons between them meaningful. Different "allTime" analyses run on different dates show how the overall picture genuinely changes.

If there are not enough "allTime" analyses for a trend (less than 2), fall back to including "manual" analyses (which also tend to cover broad date ranges).

## Changes

### File: `src/hooks/usePainPointEvolution.ts`

1. **Add `analysis_period` filter to query**: Filter for `analysis_period = 'allTime'` first. If fewer than 2 results, also include `'manual'` as a fallback.

2. **Deduplicate per month**: When multiple analyses of the same type exist in one month (e.g., two "allTime" runs on Feb 3 and Feb 5), take the most recent one per month instead of averaging them -- this gives the most accurate snapshot.

3. **Fix the subtitle**: Show the actual date range of the data, not just "Monthly trends across N months" which can be misleading when the filter says "Last 6 months" but data only spans 3 months.

### File: `src/components/member-insights/PainPointEvolutionPanel.tsx`

1. **Update subtitle**: Show the actual data period (e.g., "Dec 2025 -- Feb 2026") alongside the month count so the label matches the filter selection accurately.

2. **Add info text**: When the time range filter shows more months than data available, show a note like "Data available for 3 of 6 months" to set expectations.

## Technical Details

### Query change (hook)
```text
Current:  .eq('status', 'completed')  -- fetches ALL analysis types
Proposed: .eq('status', 'completed').in('analysis_period', ['allTime'])
Fallback: .eq('status', 'completed').in('analysis_period', ['allTime', 'manual'])
```

### Deduplication logic
```text
For each month bucket:
  - If multiple analyses exist, keep only the latest one (by created_at)
  - This prevents averaging duplicate runs and gives the most current snapshot
```

### Files Changed
- `src/hooks/usePainPointEvolution.ts` -- filter by analysis_period, deduplicate per month
- `src/components/member-insights/PainPointEvolutionPanel.tsx` -- improve subtitle accuracy
