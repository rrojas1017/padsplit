

# Fix: Coaching Hub Default Filter + Eastern Time Alignment

## Problem
1. The Coaching Hub defaults to `'today'` filter — users land on an empty page if no calls have come in yet today
2. Date calculations use `new Date()` which depends on runtime timezone (UTC in preview). The user expects Eastern Standard Time. When the preview runs in UTC, "today" and "yesterday" point to the wrong calendar day for an EST user.

## Fix

### 1. `src/pages/CoachingHub.tsx`
- Change default `dateRange` from `'today'` to `'last_7_days'` (`'7d'`) so the page always shows recent coaching data on load

### 2. `src/utils/dashboardCalculations.ts`
- Create a helper `getEasternNow()` that returns the current date/time adjusted to US Eastern (America/New_York)
- Use it in `getDateRangeFromFilter()` instead of bare `new Date()` so all date range calculations (today, yesterday, 7d, 30d, month) anchor to Eastern time

The helper:
```typescript
function getEasternNow(): Date {
  // Get current time string in Eastern, then parse it back
  const eastern = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
  return new Date(eastern);
}
```

Then replace `const today = startOfDay(new Date())` with `const today = startOfDay(getEasternNow())` in `getDateRangeFromFilter`.

### 3. `src/hooks/useCoachingData.ts`
- No changes needed — the hook fetches ALL coaching data without date filters; filtering is done client-side in CoachingHub

## Impact
- Coaching Hub loads with 7 days of data by default
- All date filters across Dashboard, Coaching Hub, Leaderboard, etc. that use `getDateRangeFromFilter` will now anchor to Eastern time
- The 4 April 3rd coaching records will be visible immediately

| File | Change |
|------|--------|
| `src/pages/CoachingHub.tsx` | Change default `dateRange` from `'today'` to `'7d'` |
| `src/utils/dashboardCalculations.ts` | Add `getEasternNow()` helper; use in `getDateRangeFromFilter` |

