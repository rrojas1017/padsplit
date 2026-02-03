

## Fix Communication Insights Date Range Filtering

✅ **COMPLETED**

### Summary

Fixed the issue where selecting different date ranges (e.g., "Last 7 Days" vs. "All Time") did not properly filter the displayed insights.

### Changes Made

**Phase 1: Fixed Period Tagging**
- Updated `BookingInsightsTab.tsx` and `MemberInsights.tsx` to pass the actual `dateRange` value (e.g., `last7days`, `allTime`) instead of hardcoded `'manual'`
- Edge functions already correctly stored whatever period they received - the bug was in the frontend

**Phase 2: Added Period Filtering in UI**
- `BookingInsightsTab.tsx`: Added `getPeriodFilters()` helper for backward compatibility (treats `manual` as `allTime`)
- Updated `fetchInsights()` to filter by current `dateRange` using `.in('analysis_period', periodFilters)`
- Added `dateRange` as a dependency to re-fetch when period changes
- Auto-selects most recent insight for selected period, clears selection when switching to empty period

- `NonBookingAnalysisTab.tsx`: Already had this filtering in place (confirmed working)

- `MemberInsights.tsx`: Applied same filtering logic to standalone page

**Phase 3: Added User Feedback**
- Added "No analysis for this period" banner when switching to a period without existing insights
- Added period badge showing which date range the currently displayed insight covers
- Added actual date range display (e.g., "Jan 27 - Feb 3, 2025")
- Added analysis timestamp next to period info

### Expected Behavior

1. **When you select "Last 7 Days":**
   - The insights list shows only analyses tagged as `last7days`
   - If none exist, a prompt appears asking you to "Run Analysis" for this period
   - New analysis will process only calls from the last 7 days

2. **When you select "All Time":**
   - The insights list shows `allTime` AND legacy `manual` tagged analyses
   - Results reflect all transcribed calls

3. **Visual Indicators:**
   - Badge showing current insight's analysis period
   - Actual date range displayed (e.g., "Jan 27 - Feb 3")
   - Analysis timestamp for reference
