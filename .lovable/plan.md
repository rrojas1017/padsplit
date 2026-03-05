

# Fix: Dashboard Counting Research Records as Bookings

## Root Cause
The dashboard's `filterActualBookings` function only excludes records with status `'Non Booking'`, but does **not** exclude records with status `'Research'` (record_type = 'research'). There are **1,169 research records** in the last 90 days being counted as actual bookings in all KPIs, charts, and leaderboards.

Database confirms only **34 records today**, not 966. The inflated number comes from research records being included in booking counts.

## Fix

### 1. Update `filterActualBookings` in `dashboardCalculations.ts`
Exclude both `'Non Booking'` and `'Research'` statuses:
```ts
const filterActualBookings = (bookings: Booking[]): Booking[] => {
  return bookings.filter(b => b.status !== 'Non Booking' && b.status !== 'Research');
};
```

### 2. Add `record_type` to data fetching
Add `record_type` to the select columns in both:
- `BookingsContext.tsx` — the main query
- `useDashboardData.ts` — the `LIGHTWEIGHT_COLUMNS` constant

And map it in the transform functions so the `recordType` field is available on `Booking` objects.

### 3. Belt-and-suspenders: also filter by `recordType`
Update `filterActualBookings` to also check `recordType !== 'research'` for safety:
```ts
const filterActualBookings = (bookings: Booking[]): Booking[] => {
  return bookings.filter(b => 
    b.status !== 'Non Booking' && 
    b.status !== 'Research' && 
    b.recordType !== 'research'
  );
};
```

### Files Changed
- `src/utils/dashboardCalculations.ts` — exclude Research status
- `src/contexts/BookingsContext.tsx` — add `record_type` to select + transform
- `src/hooks/useDashboardData.ts` — add `record_type` to LIGHTWEIGHT_COLUMNS + transformRow

