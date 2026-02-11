

# Fix: Date Filter Mismatch on Market Intelligence

## Problem
The date filter button shows "Today" on page load, but the actual data query uses "All Time." This is because:
- `MarketIntelligence.tsx` initializes state as `'all'`
- `DateRangeFilter` component internally defaults to `'today'`
- No `defaultValue` prop is passed to sync them

## Fix
One-line change in `src/pages/MarketIntelligence.tsx` line 121:

Pass the `defaultValue` prop so the filter UI matches the page's data state:

```
<DateRangeFilter
  onRangeChange={handleRangeChange}
  includeAllTime={true}
  includeCustom={true}
  defaultValue="all"         // <-- add this
/>
```

This ensures the filter button displays "All Time" on load, matching the actual data being shown.

## Files Changed
- `src/pages/MarketIntelligence.tsx` -- add `defaultValue="all"` prop (1 line)

