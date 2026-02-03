
# Plan: Apply Non-Booking Separation to All Wallboard Views

## Overview
Update the internal Wallboard and Public Wallboard pages to exclude "Non Booking" records from their booking counts. This ensures consistency across all agent-facing views where performance metrics should only reflect actual bookings.

## Background
The changes made to Dashboard, Leaderboard, My Performance, and My Bookings now correctly separate actual bookings from call activity records (status = "Non Booking"). However, two additional pages still need this update:
- Internal Wallboard (live operations dashboard)
- Public Wallboard (externally shareable display link)

Additionally, the edge function that serves the Public Wallboard data should filter at the database level for efficiency.

## Files Affected

| File | Current State | Change Required |
|------|--------------|-----------------|
| `src/pages/Wallboard.tsx` | Counts all bookings regardless of status | Add filter to exclude Non Booking |
| `src/pages/PublicWallboard.tsx` | Counts all bookings regardless of status | Add filter to exclude Non Booking |
| `supabase/functions/get-wallboard-data/index.ts` | Returns all bookings | Add database-level filter to exclude Non Booking |

## Technical Details

### 1. Internal Wallboard (`src/pages/Wallboard.tsx`)

Add a helper function and apply it to all booking filters:

```text
// Helper to filter actual bookings (exclude Non Booking status)
const filterActualBookings = (list: typeof bookings) => 
  list.filter(b => b.status !== 'Non Booking');

// Apply to existing filters
const actualBookings = filterActualBookings(bookings);
const todayBookings = actualBookings.filter(...);
const yesterdayBookings = actualBookings.filter(...);
```

This ensures:
- "Total Bookings Today" card shows only real bookings
- "Vixicom" and "PadSplit Internal" site cards show only real bookings
- "Yesterday" comparison shows only real bookings
- All percentage change calculations are accurate

### 2. Public Wallboard (`src/pages/PublicWallboard.tsx`)

Same pattern as Internal Wallboard:

```text
// Helper to filter actual bookings
const filterActualBookings = (list: Booking[]) => 
  list.filter(b => b.status !== 'Non Booking');

// Apply to existing filters
const actualBookings = filterActualBookings(bookings);
const todayBookings = actualBookings.filter(...);
const yesterdayBookings = actualBookings.filter(...);
```

### 3. Edge Function (`supabase/functions/get-wallboard-data/index.ts`)

Add status filter to the database query for efficiency:

```text
const { data: bookings, error: bookingsError } = await supabase
  .from('bookings')
  .select('*')
  .gte('booking_date', dateLimit)
  .neq('status', 'Non Booking')  // <-- Add this filter
  .order('booking_date', { ascending: false })
  .limit(500);
```

This reduces data transfer and processing by excluding Non Booking records at the database level.

## Impact

- Internal Wallboard will show accurate booking counts
- Public (TV) displays will show accurate booking counts  
- Leaderboard on both wallboards uses `calculateLeaderboard` which already filters correctly
- Data transfer to Public Wallboard will be reduced slightly

## No Changes Needed

The following files are already correct:
- `src/hooks/useAgentGoals.ts` - Already filters with `.in('status', ['Pending Move-In', 'Moved In'])`
- All dashboard calculation utilities - Already use `filterActualBookings`
- All previously updated pages (Dashboard, Leaderboard, MyPerformance, MyBookings)
