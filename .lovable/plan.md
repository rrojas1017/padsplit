
# Plan: Exclude Non-Booking Records from Agent Booking Stats

## Overview
Update all booking-related calculations and displays to exclude "Non Booking" status records from actual booking counts, while adding a dedicated summary card showing the total non-booking calls for the selected period.

## Background
The `bookings` table stores both actual bookings (with statuses like "Pending Move-In", "Moved In", etc.) and call records that did not result in a booking (status = "Non Booking"). Currently, these non-booking records are being counted in agent performance metrics, inflating their booking numbers.

## Changes Required

### 1. Update Dashboard Calculations (`src/utils/dashboardCalculations.ts`)
Add a filter to exclude "Non Booking" status from all booking-related calculations:

- **`calculateKPIData`**: Filter out Non Booking records before counting total bookings, site bookings, and pending move-ins
- **`calculateChartData`**: Filter out Non Booking records from daily chart data
- **`calculateLeaderboard`**: Filter out Non Booking records from agent booking counts
- **`calculateMarketData`**: Filter out Non Booking records from market breakdown
- **`calculateInsightsData`**: Filter out Non Booking records from insights calculations

Create a helper function:
```text
const ACTUAL_BOOKING_STATUSES = ['Pending Move-In', 'Moved In', 'Member Rejected', 'No Show', 'Cancelled', 'Postponed'];

const filterActualBookings = (bookings: Booking[]): Booking[] => {
  return bookings.filter(b => b.status !== 'Non Booking');
};
```

Add a new function to calculate non-booking counts for any date range:
```text
export const calculateNonBookingCount = (
  bookings: Booking[],
  dateFilter: DateRangeFilter,
  customDates?: CustomDateRange
): number => {
  const { start, end } = getDateRangeFromFilter(dateFilter, customDates);
  const filtered = filterBookingsByDateRange(bookings, start, end);
  return filtered.filter(b => b.status === 'Non Booking').length;
};
```

### 2. Update Dashboard Page (`src/pages/Dashboard.tsx`)
- Import the new `calculateNonBookingCount` function
- Add a Non-Bookings summary card in the "Today's Insights" section showing the count for the selected period

### 3. Update My Performance Page (`src/pages/MyPerformance.tsx`)
- Filter agent's bookings to exclude "Non Booking" status in all calculations
- Add a Non-Bookings summary card showing the agent's total non-booking calls for the period
- Update the chart data to only show actual bookings

### 4. Update My Bookings Page (`src/pages/MyBookings.tsx`)
- Update the status filter options to exclude "Non Booking" from the default list (since it's a different type of record)
- Add a new summary card showing total Non-Booking calls
- Filter the main booking list to exclude "Non Booking" by default (they should view these in Call Insights/Reports)
- Update `summaryStats` calculation to exclude Non Booking from totals

### 5. Update Leaderboard Page (`src/pages/Leaderboard.tsx`)
- Add a summary card showing total Non-Booking calls for all agents
- The leaderboard will automatically be corrected once `calculateLeaderboard` is updated

## Visual Changes

### Dashboard
Add a new insight card in the "Today's Insights" section:
```text
+-----------------------------------+
| Non-Booking Calls                 |
| [amber color indicator]           |
| X calls                           |
| In selected period                |
+-----------------------------------+
```

### My Performance
Add a new summary stat card:
```text
+-----------------------------------+
| Non-Booking Calls                 |
| [Phone icon - amber]              |
| X                                 |
| vs Y previous period              |
+-----------------------------------+
```

### My Bookings
Add a new summary card and update totals:
```text
Before: Total shows bookings + non-bookings mixed
After:  Total shows only actual bookings
        + New card: "Non-Bookings: X"
```

### Leaderboard
Add a summary card in the stats row:
```text
+-----------------------------------+
| Non-Booking Calls                 |
| [Phone icon]                      |
| X total                           |
+-----------------------------------+
```

## Files to Modify

| File | Change |
|------|--------|
| `src/utils/dashboardCalculations.ts` | Add non-booking filter to all calculations, add `calculateNonBookingCount` function |
| `src/pages/Dashboard.tsx` | Add Non-Bookings summary in insights section |
| `src/pages/MyPerformance.tsx` | Filter non-bookings from stats, add summary card |
| `src/pages/MyBookings.tsx` | Filter non-bookings from list and stats, add summary card |
| `src/pages/Leaderboard.tsx` | Add non-bookings summary card |

## Impact
- Agent booking counts will decrease to reflect only actual bookings
- Non-booking call activity will be clearly separated and visible
- Reports page already handles this correctly and needs no changes
- Historical data integrity is maintained - no database changes required
