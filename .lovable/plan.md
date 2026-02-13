

## Fix: Pain Point Evolution Chart Not Displaying Data

### Root Cause

The chart requires at least 2 monthly data points to render. Currently:
- Step 1 fetches only `allTime` analyses -- all of which have `date_range_end` in February 2026
- Monthly deduplication collapses all February analyses into a single data point
- Step 2 fallback only adds `manual` period analyses, which don't exist
- Result: only 1 data point, so the "need 2 analyses" empty state shows

Meanwhile, there ARE completed analyses for other periods (`lastMonth` ending Jan 31, `last3months`, `thisMonth`, etc.) that would provide additional monthly data points -- but they're excluded by the filter.

### Solution

Expand the query strategy in `usePainPointEvolution.ts`:

1. **Primary query**: Keep fetching `allTime` analyses first (preferred for consistency)
2. **Expanded fallback**: If fewer than 2 monthly data points result, broaden the query to include ALL completed analysis periods (`allTime`, `manual`, `lastMonth`, `thisMonth`, `last3months`, `last30days`, `last7days`, `thisWeek`)
3. **Deduplication stays**: The "latest per month" dedup remains to avoid double-counting, but now it can pull in January (`lastMonth` ending 2026-01-31), November (`last3months` starting 2025-11), etc.

This gives the chart multiple months of evolution data from the analyses that already exist.

### Technical Details

**File**: `src/hooks/usePainPointEvolution.ts`

**Change**: Update the fallback query (around lines 178-192) to remove the `.in('analysis_period', ['allTime', 'manual'])` filter entirely, fetching all completed analyses regardless of period. The monthly deduplication already handles overlap by keeping only the latest analysis per month.

**Why this is safe**: The deduplication logic ensures only one analysis per month is used, and it picks the most recent one. Different period types covering the same month won't conflict -- the latest `created_at` wins.
