
# Fix "Sentiment Trends Over Time" Chart Issues

## Problems Identified

1. **Missing Data in List Query**: The chart receives an array of insights, but the list query only fetches `id, analysis_period, date_range_start, date_range_end, total_calls_analyzed, created_at, status` - it does NOT fetch `sentiment_distribution`. The code then defaults all sentiment values to zeros.

2. **Duplicate Dates on X-Axis**: Multiple analyses on the same day (e.g., 5 analyses on Jan 30) all show as "Jan 30" making the X-axis confusing and repetitive.

3. **Misleading Flat Lines**: Users see flat lines at 0% for most data points, creating a false impression that sentiment was neutral/zero historically.

## Solution

### Change 1: Include sentiment_distribution in the list query

Update `BookingInsightsTab.tsx` to fetch `sentiment_distribution` in the initial list query:

| File | Change |
|------|--------|
| `src/components/call-insights/BookingInsightsTab.tsx` | Add `sentiment_distribution` to the SELECT clause (line 93) |

```typescript
// Before
.select('id, analysis_period, date_range_start, date_range_end, total_calls_analyzed, created_at, status')

// After  
.select('id, analysis_period, date_range_start, date_range_end, total_calls_analyzed, created_at, status, sentiment_distribution')
```

Then update the mapping (line 106) to use actual data:

```typescript
sentiment_distribution: d.sentiment_distribution || { positive: 0, neutral: 0, negative: 0 },
```

### Change 2: Improve X-axis date formatting

Update `TrendChart.tsx` to show time when there are multiple analyses on the same day:

| File | Change |
|------|--------|
| `src/components/member-insights/TrendChart.tsx` | Use unique date/time labels to prevent duplicates |

Strategy: Check for duplicate dates and append time if needed:
- If only one analysis on a day: "Jan 30"
- If multiple analyses on same day: "Jan 30 4pm", "Jan 30 5pm"

### Change 3: Add analysis period context to tooltip

Enhance the tooltip to show what date range each analysis covered, not just when it was run:

```text
Current: "Jan 30, 2026"
Enhanced: "Jan 30, 2026 • Analyzed: Last 30 Days (Dec 31 - Jan 30)"
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/call-insights/BookingInsightsTab.tsx` | Add `sentiment_distribution` to SELECT query and remove default zeros override |
| `src/components/member-insights/TrendChart.tsx` | Add time suffix for duplicate dates, improve tooltip with date range context |

## Visual Result After Fix

```text
Before:
- X-axis: Dec 30, Jan 12, Jan 28, Jan 28, Jan 28, Jan 29, Jan 30, Jan 30, Jan 30, Jan 30
- Lines: Flat at 0% until final spike

After:
- X-axis: Dec 16, Dec 22, Dec 31, Jan 12, Jan 28, Jan 29, Jan 30 (deduplicated or time-stamped)
- Lines: Consistent ~83-87% positive, ~9-17% neutral, ~0-3% negative across all points
```

## Technical Notes

- This is a data-fetching bug, not an analysis bug - the sentiment data exists correctly in the database
- Adding one column to the SELECT has minimal performance impact
- The trend chart will now accurately reflect the consistent sentiment patterns across all historical analyses
