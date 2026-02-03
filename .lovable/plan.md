

## Fix Communication Insights Date Range Filtering

This plan addresses the issue where selecting different date ranges (e.g., "Last 7 Days" vs. "All Time") does not properly filter the displayed insights or show appropriate results.

### Summary

The investigation revealed two core issues:
1. **Insights are not tagged with their analysis period** - All records store `analysis_period = 'manual'` instead of the actual period like `last7days` or `allTime`
2. **UI does not filter or auto-select insights by period** - Changing the date range dropdown only affects NEW analyses, not which existing analysis is displayed

### Current Data Distribution

| Date Range | Booking Calls (Transcribed) | Non-Booking Calls (Transcribed) |
|------------|-----------------------------|---------------------------------|
| Last 7 days | 90 | **0** |
| Last 30 days | 371 | 0 |
| All Time | 701 | 77 |

This explains why Non-Booking analysis shows the same results - there's no recent Non-Booking transcribed data.

### Changes

**Phase 1: Fix Period Tagging**

**File: `supabase/functions/analyze-member-insights/index.ts`**
- Change line where `analysis_period` is set to use the actual period passed from frontend (`last7days`, `last30days`, etc.) instead of always using `'manual'`
- This enables filtering historical insights by their date range

**File: `supabase/functions/analyze-non-booking-insights/index.ts`**
- Same fix - use the actual `analysis_period` value from the request body

**Phase 2: Filter Insights List by Selected Period**

**File: `src/components/call-insights/BookingInsightsTab.tsx`**
- Update `fetchInsights()` to filter by the current `dateRange` prop
- Add `dateRange` as a dependency to re-fetch when it changes
- Auto-select the most recent insight matching the selected period
- Show "No analysis for this period" message when switching to a period without existing insights (similar to how NonBookingAnalysisTab already does this)

**File: `src/pages/MemberInsights.tsx`**
- Apply the same filtering logic to the standalone Member Insights page
- Filter the insights list query by `analysis_period` matching the selected date range

**Phase 3: Improve User Feedback**

**File: `src/components/call-insights/BookingInsightsTab.tsx`**
- Add a badge showing which period the currently displayed insight covers
- Add a banner when no insights exist for the selected period (like Non-Booking already has)
- Display the actual date range (e.g., "Jan 27 - Feb 3") next to the analysis

**File: `src/components/call-insights/NonBookingAnalysisTab.tsx`**
- Add info message when there are 0 transcribed non-booking calls in the selected period
- Explain that the "All Time" data is being shown because recent data doesn't exist

### Expected Behavior After Fix

1. **When you select "Last 7 Days":**
   - The insights list shows only analyses tagged as `last7days`
   - If none exist, a prompt appears asking you to "Run Analysis" for this period
   - New analysis will only process the ~90 calls from Jan 27 - Feb 3

2. **When you select "All Time":**
   - The insights list shows only `allTime` tagged analyses
   - Results reflect all ~701 transcribed calls

3. **For Non-Booking (special case):**
   - Show a warning when there are 0 transcribed calls in the selected period
   - Suggest either selecting "All Time" or waiting for more Non-Booking transcriptions

### Technical Notes

- No database migrations required
- Existing insights with `analysis_period = 'manual'` will be treated as "All Time" for backward compatibility
- The edge function already receives the correct `analysis_period` value - it's just not storing it properly

