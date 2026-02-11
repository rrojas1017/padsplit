

# Fix Dashboard "All Time" Filter Showing Only 698 Records

## Problem
The Dashboard gets its data from `BookingsContext`, which hard-limits queries to the **last 90 days** and **2,000 rows**. When you select "All Time", it only filters within those 698 pre-fetched records instead of querying all 5,943 records in the database.

## Why This Happens
- `BookingsContext` (line 44-67) applies `.gte('booking_date', dateLimit)` where `dateLimit` = 90 days ago
- The Dashboard's date filter is purely client-side -- it filters records already in memory
- The Reports page works correctly because it uses a separate `useReportsData` hook with server-side queries

## Solution
Create a dedicated `useDashboardData` hook that performs **server-side aggregation** for the Dashboard KPIs when "All Time" (or ranges beyond 90 days) is selected. This avoids expanding `BookingsContext` (which would slow down the entire app).

### Approach: Server-Side KPI Query

1. **New hook: `src/hooks/useDashboardData.ts`**
   - When the date filter is `today`, `yesterday`, `7d`, `30d`, or `month` -- continue using `BookingsContext` data (it covers these ranges)
   - When the filter is `all` or `custom` (with dates older than 90 days) -- query the database directly with the appropriate date filters and no 90-day cap
   - Fetch with `.order('booking_date', { ascending: false })` and no row limit cap for "all time" (use pagination if needed)
   - Return the same `Booking[]` shape so all existing `calculateKPIData`, `calculateChartData`, etc. functions continue to work unchanged

2. **Update `src/pages/Dashboard.tsx`**
   - Replace the direct `useBookings()` usage with the new `useDashboardData(dateRange, customDates)` hook
   - The hook returns `{ bookings, isLoading }` -- same interface, so no other changes needed
   - Keep `BookingsContext` for add/update/delete operations (CRUD still uses the context)

### Technical Details

**`useDashboardData` hook logic:**
```text
if dateRange is 'all' or custom range extends beyond 90 days:
  -> Query supabase directly (same SELECT as BookingsContext but without the 90-day filter)
  -> Apply .limit(10000) as a safety cap
  -> Cache result to avoid re-fetching on every render
else:
  -> Return bookings from BookingsContext (already covers recent data)
```

**Key considerations:**
- The query selects the same lightweight columns as BookingsContext (no transcription blobs)
- For "All Time", the query will return ~5,943 rows which is manageable for client-side KPI calculations
- A loading state is shown while the larger dataset is being fetched
- Results are cached so switching back to "All Time" doesn't re-fetch

## Files Changed
- **New:** `src/hooks/useDashboardData.ts` -- smart data source that switches between context and direct DB query
- **Edit:** `src/pages/Dashboard.tsx` -- use the new hook for bookings data

