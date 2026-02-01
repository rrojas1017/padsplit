
# Date Range Filtering for Non-Booking Analysis Results

## Current Behavior

The Non-Booking Analysis tab has these components that need to respect the date filter:

| Component | Current Behavior | Expected Behavior |
|-----------|-----------------|-------------------|
| Summary Cards (stats) | Respects date filter via `get_non_booking_stats` RPC | Correct |
| Run Analysis button | Passes date range to edge function | Correct |
| Previous analyses dropdown | Shows ALL analyses regardless of date | Filter by matching date range |
| Auto-select insight | Selects most recent overall | Select most recent matching date range |
| Insight data display | Shows selected insight data | Show matching insight OR prompt to run |

---

## Implementation

### Frontend Changes

**File: `src/components/call-insights/NonBookingAnalysisTab.tsx`**

1. **Filter previous insights by date range**
   - Modify the query for `previousInsights` to filter by `analysis_period` matching the current `dateRange`
   - This ensures users only see analyses relevant to their selected time period

2. **Update auto-select logic**
   - When date range changes, find a matching insight for that period
   - If no matching insight exists, clear selection and prompt user to run analysis

3. **Add date range info to dropdown**
   - Show both timestamp AND the date range period in the dropdown items
   - Format: "Last 30 Days - Feb 1, 2026 2:30 PM"

4. **Clear insight when date range changes to unmatched period**
   - Reset `selectedInsightId` when switching to a date range with no existing analysis
   - Show "No analysis for this period" message in charts

5. **Show date range badge on analysis results**
   - Display a badge showing which period the current results are for
   - Help users understand if they're viewing stale data vs current filter

---

## Code Changes

### Query Filter Update

```typescript
// Fetch previous insights - FILTER BY DATE RANGE
const { data: previousInsights, refetch: refetchInsights } = useQuery({
  queryKey: ['non-booking-insights-list', dateRange], // Add dateRange to key
  queryFn: async (): Promise<NonBookingInsight[]> => {
    const { data, error } = await supabase
      .from('non_booking_insights')
      .select('*')
      .eq('status', 'completed')
      .eq('analysis_period', dateRange) // Filter by matching period
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;
    return (data || []) as NonBookingInsight[];
  },
});
```

### Auto-select Reset on Date Range Change

```typescript
// Reset selection when date range changes and no matching insight exists
useEffect(() => {
  if (previousInsights) {
    if (previousInsights.length > 0) {
      // Auto-select most recent insight for this period
      setSelectedInsightId(previousInsights[0].id);
    } else {
      // No insights for this period - clear selection
      setSelectedInsightId(null);
    }
  }
}, [previousInsights, dateRange]);
```

### Dropdown with Period Info

```typescript
<SelectItem key={insight.id} value={insight.id}>
  <span className="flex items-center gap-2">
    <span>{getPeriodLabel(insight.analysis_period)}</span>
    <span className="text-muted-foreground text-xs">
      {format(new Date(insight.created_at), 'MMM d, h:mm a')}
    </span>
  </span>
</SelectItem>
```

### No Data State for Unanalyzed Period

When `selectedInsightId` is null but data exists for the period:

```typescript
{!selectedInsight && hasTranscribed && (
  <Card className="border-amber-500/50 bg-amber-500/5">
    <CardContent className="py-4">
      <div className="flex items-center gap-3">
        <Sparkles className="h-5 w-5 text-amber-500" />
        <div>
          <p className="font-medium">No analysis for this time period</p>
          <p className="text-sm text-muted-foreground">
            Click "Run Analysis" to generate insights for {getPeriodLabel(dateRange)}
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
)}
```

---

## User Experience Flow

```text
User selects "Last 7 Days"
        |
        v
  Query filters to insights with analysis_period = "last7days"
        |
        v
  [Found matching insight?]
        |
    Yes |         No
        v          v
  Auto-select    Clear selection
  most recent    Show "No analysis" banner
        |          |
        v          v
  Display        Prompt to run
  charts         analysis
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/call-insights/NonBookingAnalysisTab.tsx` | Filter insights query by dateRange, update auto-select logic, add period badge |

---

## Technical Notes

- The edge function already stores `analysis_period` with each insight
- Existing insight has `analysis_period: 'allTime'` so it will only show when "All Time" is selected
- Running analysis for "Last 30 Days" will create a new insight with `analysis_period: 'last30days'`
- Users can run multiple analyses for the same period (shows history)
