
# Fix Stale Date Filtering in Communication Insights

## Problem
When you select "This Week", the system shows 106 calls — but those are from LAST week (Feb 2–6, analyzed on Feb 7). Today is Feb 10, a new week entirely. The filter matches on the stored string label (`analysis_period = 'thisWeek'`) instead of checking whether the analysis's actual date range falls within the current calendar week.

This affects all relative period filters (This Week, This Month, Last Month) since they become stale as time passes.

## Root Cause
In `BookingInsightsTab.tsx` (line 104-108), the query filters like this:
```
.in('analysis_period', ['thisWeek'])
```
This matches ANY record ever tagged "thisWeek", regardless of what dates it actually covers. A "This Week" analysis from 3 weeks ago would still show up.

The same pattern exists in `NonBookingAnalysisTab.tsx`.

## Solution
Replace the string-label filter with actual date-range overlap filtering. When the user selects "This Week":

1. Calculate the current week's boundaries (Mon Feb 10 – Sun Feb 16)
2. Query where `date_range_start` and `date_range_end` overlap with that range
3. If no matching analysis exists, show the "No analysis for this period — click Run Analysis" banner (which already exists)

## Changes

### 1. `src/components/call-insights/BookingInsightsTab.tsx`
- Modify `fetchInsights()` to calculate the expected date range for the selected period using `getDateRange()`
- Replace `.in('analysis_period', periodFilters)` with `.gte('date_range_start', startDate).lte('date_range_start', endDate)` to match analyses whose date range overlaps the selected period
- Remove the `getPeriodFilters` helper (no longer needed)

### 2. `src/components/call-insights/NonBookingAnalysisTab.tsx`
- Apply the same date-range-based filtering to the non-booking insights query
- Replace the `analysis_period` string filter with date range overlap checks

## What Does NOT Change
- No database or backend changes needed
- The `analysis_period` column is still written for display/labeling purposes
- The "Run Analysis" flow remains the same
- All other UI components remain untouched

## Expected Result
- "This Week" will either show an analysis whose dates match this week (Feb 10–16), or show the "No analysis — click Run Analysis" prompt
- Old analyses from previous weeks will no longer incorrectly appear under "This Week"
- Users get accurate, current data for every time period filter
