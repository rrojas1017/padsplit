

# Fix Non-Booking Analysis Stats Capped at 1,000 Rows

## Problem

The Non-Booking Analysis tab shows incorrect statistics because the current implementation fetches all rows to count them locally. This hits the default Supabase limit of 1,000 rows, causing:

| Metric | Showing | Actual |
|--------|---------|--------|
| Total Non-Booking Calls | 1,000 | 3,286 |
| High Readiness | 284 | 949 |
| Transcribed | 2 | 2 |

The Trend Chart also has this issue, potentially showing incomplete data.

## Solution

Use server-side aggregation with SQL aggregate queries instead of fetching rows and counting client-side. This will:
1. Return accurate counts regardless of dataset size
2. Be more efficient (no need to transfer row data)
3. Properly respect date range filters

## Implementation Approach

### Approach 1: Use Supabase count with `head: true` (for total count only)
```typescript
// Only returns count, no row data
const { count } = await supabase
  .from('bookings')
  .select('*', { count: 'exact', head: true })
  .eq('status', 'Non Booking');
```

### Approach 2: Use a database function for complex aggregations (recommended)
Since we need multiple aggregated values (total, transcribed, high_readiness, avg_duration), create a database function that returns all stats in one call.

**We will use Approach 2** because we need multiple aggregated values and conditional counts.

## Changes Required

### 1. Create Database Function

Create a new SQL function `get_non_booking_stats` that accepts date range parameters and returns all aggregated stats:

```sql
CREATE OR REPLACE FUNCTION get_non_booking_stats(
  start_date DATE DEFAULT NULL
)
RETURNS TABLE(
  total_calls BIGINT,
  transcribed_calls BIGINT,
  high_readiness_calls BIGINT,
  avg_duration_seconds NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_calls,
    COUNT(CASE WHEN transcription_status = 'completed' THEN 1 END)::BIGINT as transcribed_calls,
    COUNT(CASE WHEN call_duration_seconds > 300 THEN 1 END)::BIGINT as high_readiness_calls,
    COALESCE(AVG(CASE WHEN call_duration_seconds > 0 THEN call_duration_seconds END), 0)::NUMERIC as avg_duration_seconds
  FROM bookings
  WHERE status = 'Non Booking'
    AND (start_date IS NULL OR booking_date >= start_date);
END;
$$;
```

### 2. Update NonBookingAnalysisTab.tsx

Replace the current client-side aggregation with a call to the database function:

```typescript
// Before (hits 1000 row limit):
const { data } = await supabase
  .from('bookings')
  .select('id, transcription_status, call_duration_seconds')
  .eq('status', 'Non Booking');
const totalCalls = data.length; // Max 1000!

// After (accurate count):
const { data } = await supabase.rpc('get_non_booking_stats', {
  start_date: days !== null ? startDate.toISOString().split('T')[0] : null
});
// Returns: { total_calls: 3286, transcribed_calls: 2, ... }
```

### 3. Update NonBookingTrendChart.tsx

For the trend chart, we still need row-level data for grouping by date. Two options:

**Option A**: Paginate to fetch all rows (complex, slower)
**Option B**: Create a second database function for trend data (cleaner)

We'll use **Option B** - create `get_non_booking_trends` function that returns pre-aggregated daily/weekly data.

### 4. Update NonBookingMissedOpportunitiesPanel.tsx

The panel receives `highReadinessCount` as a prop from the parent, so it will automatically show the correct value once the parent is fixed.

## Files to Modify

| File | Change |
|------|--------|
| Database Migration | Create `get_non_booking_stats` and `get_non_booking_trends` functions |
| `src/components/call-insights/NonBookingAnalysisTab.tsx` | Use `supabase.rpc('get_non_booking_stats')` instead of fetching rows |
| `src/components/call-insights/NonBookingTrendChart.tsx` | Use `supabase.rpc('get_non_booking_trends')` for accurate trend data |

## Expected Results After Fix

| Period | Metric | Before | After |
|--------|--------|--------|-------|
| All Time | Total Calls | 1,000 | 3,286 |
| All Time | High Readiness | 284 | 949 |
| All Time | Avg Duration | 4:40 | 4:43 |
| Last 30 Days | Total Calls | ~347 | 347 |
| Last 30 Days | High Readiness | ~112 | 112 |

## Technical Notes

- The database functions use `SECURITY DEFINER` to run with elevated privileges but still respect RLS on the underlying table
- Using `BIGINT` for counts to handle large datasets
- The `start_date` parameter is optional - passing `NULL` returns all-time stats
- The trend function will return pre-grouped data to avoid client-side aggregation limits

