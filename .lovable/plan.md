

# Fix: QA Dashboard "Yesterday" Filter Shows Wrong Count

## Problem
The QA Dashboard shows **48 Scored Calls** when filtering by "Yesterday", but there are only **22 records** for yesterday and **26 for the day before**.

The screenshot shows the filter is set to "Yesterday", but the Scored Calls count includes records from **yesterday through today** instead of just yesterday.

## Root Cause
The `filteredBookings` filter (for QA stats) has a bug where the "yesterday" case doesn't set a proper end date.

**Current code (lines 68-91):**
```typescript
case 'yesterday':
  startDate = startOfDay(subDays(now, 1));  // Feb 5
  break;
// ... later ...
return filtered.filter(b => {
  return isWithinInterval(bookingDate, { start: startDate, end: endOfDay(now) }); // ❌ Feb 6
});
```

This means "Yesterday" actually returns records from **yesterday through today** (48 = 26 + 22).

Meanwhile, the `filteredCoachingBookings` filter correctly handles this:
```typescript
case 'yesterday':
  startDate = startOfDay(subDays(now, 1));
  endDate = endOfDay(subDays(now, 1));  // ✅ Correct!
  break;
```

## Solution
Refactor `filteredBookings` to match the pattern used in `filteredCoachingBookings` - define a separate `endDate` variable that is set correctly for each filter type.

## File Changes

### `src/pages/QADashboard.tsx`

**Lines 46-92** - Replace the filteredBookings useMemo with proper end date handling:

```typescript
// Filter by date range and agent
const filteredBookings = useMemo(() => {
  let filtered = qaBookings;
  
  if (selectedAgent !== 'all') {
    filtered = filtered.filter(b => b.agentId === selectedAgent);
  }
  
  if (dateRange === 'all') return filtered;
  
  const now = new Date();
  let startDate: Date;
  let endDate = endOfDay(now);  // Default to end of today
  
  if (dateRange === 'custom' && customDates) {
    startDate = startOfDay(customDates.from);
    endDate = endOfDay(customDates.to);
  } else {
    switch (dateRange) {
      case 'today':
        startDate = startOfDay(now);
        break;
      case 'yesterday':
        startDate = startOfDay(subDays(now, 1));
        endDate = endOfDay(subDays(now, 1));  // ✅ FIX: End at yesterday EOD
        break;
      case '7d':
        startDate = startOfDay(subDays(now, 6));
        break;
      case '30d':
        startDate = startOfDay(subDays(now, 29));
        break;
      case 'month':
        startDate = startOfMonth(now);
        break;
      default:
        startDate = new Date(0);
    }
  }

  return filtered.filter(b => {
    const bookingDate = new Date(b.bookingDate + 'T00:00:00');
    return isWithinInterval(bookingDate, { start: startDate, end: endDate });  // ✅ Use endDate variable
  });
}, [qaBookings, dateRange, selectedAgent, customDates]);
```

## Expected Result
After this fix:
- **Yesterday filter** → Shows only yesterday's 22 records (not 48)
- **Today filter** → Shows only today's records
- **7d, 30d, Month, All** → Continue working as expected
- Both QA stats and Katty's coaching stats will use consistent date filtering

