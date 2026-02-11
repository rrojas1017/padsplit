

# Fix Default Date Range and Analysis Filtering

## Problems

1. **Wrong default**: The shared `dateRange` state in `CallInsights.tsx` defaults to `'thisMonth'` instead of `'allTime'`.

2. **All filters show same analysis**: The `BookingInsightsTab` query filters stored `member_insights` records by checking if `date_range_start` falls within the selected period. Since every stored analysis has a `date_range_start` that falls within "All Time" (and likely within "This Month" too), all filters return the same most-recent analysis with 17 calls.

   The correct approach: filter by the `analysis_period` column to find analyses that were actually **run for** that period, rather than filtering by date arithmetic on `date_range_start`.

## Changes

### 1. `src/pages/CallInsights.tsx`
- Change default `dateRange` from `'thisMonth'` to `'allTime'` (line 44)

### 2. `src/components/call-insights/BookingInsightsTab.tsx`
- Fix the `fetchInsights` query (lines 97-106): instead of filtering by `.gte('date_range_start', startStr).lte('date_range_start', endStr)`, filter by `.eq('analysis_period', dateRange)` to match analyses that were run for the selected period
- Keep the date range calculation for the "Run Analysis" call (it still needs start/end dates when triggering a new analysis)
- This ensures "All Time" shows only analyses run with period `'allTime'`, "This Week" shows only `'thisWeek'` analyses, etc.

### 3. `src/components/call-insights/NonBookingAnalysisTab.tsx`
- Apply the same fix: filter stored `non_booking_insights` by `analysis_period` instead of date range arithmetic, for consistency across all tabs

## Result
- All tabs default to "All Time" on load
- Each date filter shows only analyses that were actually run for that specific period
- "This Week" and "This Month" will no longer show the same analysis unless one was explicitly run for each

