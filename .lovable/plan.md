

## Fix: Dashboard showing 0 bookings for "yesterday"

### Root cause

The `BookingsContext` fetches a maximum of **2,000 records** from the last 90 days, ordered by `booking_date DESC`. There are currently **4,777 records** in that window (many are research records). This means the context only has the most recent ~2,000 rows — older dates (including yesterday, if today has enough volume) get truncated.

When you select "yesterday" on the dashboard, `useDashboardData` falls back to the context (since `needsDirectQuery` only returns `true` for "all" or custom ranges >90 days). The context doesn't have yesterday's data → 0.

### Fix

**File: `src/hooks/useDashboardData.ts`**

Change `needsDirectQuery` to return `true` for **all date ranges except "today"**. Today's data is always in the context (it's the most recent). For everything else — yesterday, 7d, 30d, month — perform a direct server query with the correct date filter to guarantee complete data.

This is a one-line change:

```typescript
function needsDirectQuery(dateRange: DateRangeFilterType, customDates?: CustomDateRange): boolean {
  // Only "today" is safe to use from context (most recent data always present)
  return dateRange !== 'today';
}
```

The `fetchAllBookings` function already handles pagination and date filtering correctly. We just need to pass the date filter for non-custom ranges too:

In the `fetchDirect` callback, compute `dateFilter` for all ranges (not just custom):

```typescript
const { start, end } = getDateRangeFromFilter(dateRange, customDates);
const dateFilter = { 
  from: format(start, 'yyyy-MM-dd'), 
  to: format(end, 'yyyy-MM-dd') 
};
```

This ensures "yesterday" queries the server for `booking_date = '2026-03-05'` directly and returns all 16 bookings.

### What stays the same
- "Today" still uses the fast context path
- All calculation logic in `dashboardCalculations.ts` — unchanged
- Caching in `useDashboardData` — already works per date range key

