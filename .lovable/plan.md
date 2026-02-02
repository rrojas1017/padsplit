
# Same-Time Comparison for Dashboard KPIs

## Problem Statement
Currently, the Dashboard KPI cards (Total Bookings Today, Vixicom Bookings, PadSplit Internal) compare today's count against **all of yesterday's bookings**. This creates a misleading comparison early in the day - at 10 AM, comparing 5 bookings against yesterday's full-day total of 20 would show -75%, when the real same-time comparison might be +25%.

The user wants a **real-time apples-to-apples comparison**: today's bookings created by the current time vs yesterday's bookings created by the same time.

## Current Architecture

| Component | Current Behavior | Desired Behavior |
|-----------|-----------------|------------------|
| KPI Cards (Total, Vixicom, PadSplit) | Full day vs full day | Same time vs same time |
| Insights "Today vs Yesterday" card | Already uses same-time comparison | Keep as-is |
| Wallboard stats | Full day vs full day | Same time vs same time |

## Solution

### 1. Update `calculateKPIData` Function
Modify the KPI calculation in `src/utils/dashboardCalculations.ts` to filter bookings by `createdAt` timestamp when comparing "today" vs "yesterday":

```typescript
// When dateFilter is 'today', use same-time comparison
if (dateFilter === 'today') {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();
  
  // Filter today's bookings by creation time
  currentBookings = currentBookings.filter(b => {
    if (!b.createdAt) return true;
    return b.createdAt.getHours() < currentHour || 
           (b.createdAt.getHours() === currentHour && 
            b.createdAt.getMinutes() <= currentMinutes);
  });
  
  // Filter yesterday's bookings by same time cutoff
  previousBookings = previousBookings.filter(b => {
    if (!b.createdAt) return true;
    return b.createdAt.getHours() < currentHour || 
           (b.createdAt.getHours() === currentHour && 
            b.createdAt.getMinutes() <= currentMinutes);
  });
}
```

### 2. Update `KPICard` Component
Modify the comparison label to show the time context:

- Current: "vs 15 yesterday"
- Updated: "vs 15 at this time yesterday" (when dateFilter is 'today')

### 3. Update Wallboard Page
Apply the same logic to `src/pages/Wallboard.tsx`:

```typescript
// Filter by createdAt time for same-time comparison
const now = new Date();
const currentHour = now.getHours();
const currentMinutes = now.getMinutes();

const todayByNow = todayBookings.filter(b => {
  if (!b.createdAt) return true;
  return b.createdAt.getHours() < currentHour || 
         (b.createdAt.getHours() === currentHour && 
          b.createdAt.getMinutes() <= currentMinutes);
});

const yesterdayByNow = yesterdayBookings.filter(b => {
  if (!b.createdAt) return true;
  return b.createdAt.getHours() < currentHour || 
         (b.createdAt.getHours() === currentHour && 
          b.createdAt.getMinutes() <= currentMinutes);
});
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/utils/dashboardCalculations.ts` | Add same-time filtering logic to `calculateKPIData` |
| `src/components/dashboard/KPICard.tsx` | Update comparison label to include time context |
| `src/pages/Wallboard.tsx` | Add same-time filtering for all stat cards |
| `src/types/index.ts` | Add optional `comparisonLabel` field to `KPIData` interface |

## Visual Impact

### Before (at 10:30 AM)
```
Total Bookings Today: 8
vs 25 yesterday (-68%)  <-- Misleading: comparing partial day to full day
```

### After (at 10:30 AM)
```
Total Bookings Today: 8
vs 6 at this time yesterday (+33%)  <-- Accurate: comparing same time windows
```

## Technical Notes

1. **Fallback for missing `createdAt`**: Bookings without a `createdAt` timestamp (legacy imports) will be included to avoid excluding valid data

2. **Only affects "today" filter**: Other date ranges (7d, 30d, month, custom) will continue using full-period comparisons since same-time logic doesn't apply

3. **Reuses existing pattern**: The implementation mirrors the existing `calculateInsightsData` function's same-time logic for consistency

4. **Real-time updates**: The Wallboard updates every 60 seconds and uses the current `time` state, so comparisons will stay accurate throughout the day
