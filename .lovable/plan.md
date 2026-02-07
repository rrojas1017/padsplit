

# Plan: Update Communication Insights Date Filters

## Summary
Update the date filter options for Communication Insights (both Booking and Non-Booking tabs) to match the user's preferred periods: **All Time**, **Last 3 Months**, **This Month**, **Last Month**, and **This Week**.

---

## Current vs Requested Date Filters

| Current | Requested | Change |
|---------|-----------|--------|
| Last 7 Days | **This Week** | Replace with calendar week (Mon-Today) |
| Last 30 Days | **Last Month** | Replace with previous calendar month |
| This Month | This Month | Keep (no change) |
| Last 3 Months | Last 3 Months | Fix to use `subMonths(today, 3)` |
| All Time | All Time | Keep (no change) |

---

## Date Calculation Logic

```text
┌─────────────────────────────────────────────────────────────────────┐
│  Date Filter Calculations (assuming today is Feb 7, 2026)          │
├─────────────────────────────────────────────────────────────────────┤
│  This Week:      Feb 3, 2026 (Mon) → Feb 7, 2026 (Today)           │
│  Last Month:     Jan 1, 2026 → Jan 31, 2026 (closed interval)      │
│  This Month:     Feb 1, 2026 → Feb 7, 2026 (Today)                 │
│  Last 3 Months:  Nov 7, 2025 → Feb 7, 2026 (Today)                 │
│  All Time:       Jan 1, 2024 → Feb 7, 2026 (Today)                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Files to Modify

### 1. `src/components/call-insights/BookingInsightsTab.tsx`

**Changes:**
- Update `DateRangeOption` type from `'last7days' | 'last30days' | ...` to `'thisWeek' | 'lastMonth' | ...`
- Update `getDateRange()` function with new date calculations
- Update dropdown labels in the Select component
- Update `getPeriodLabel()` function for display text
- Add import for `endOfMonth`, `subMonths`, `startOfWeek` from date-fns

### 2. `src/components/call-insights/NonBookingAnalysisTab.tsx`

**Changes:**
- Update `DateRangeOption` type
- Update `getDateRangeDays()` function (rename to `getDateRangeParams()`)
- Update dropdown labels
- Update `getPeriodLabel()` function
- Add import for `endOfMonth`, `subMonths`, `startOfWeek` from date-fns

### 3. `src/pages/CallInsights.tsx`

**Changes:**
- Update `DateRangeOption` type
- Update default `dateRange` state from `'last30days'` to appropriate default

### 4. `src/pages/MemberInsights.tsx`

**Changes:**
- Update `DateRangeOption` type
- Update `getDateRange()` function
- Update dropdown labels
- Update `getPeriodFilters()` to handle new period values

---

## Technical Details

### New Type Definition
```typescript
type DateRangeOption = 'thisWeek' | 'lastMonth' | 'thisMonth' | 'last3months' | 'allTime';
```

### New `getDateRange()` Function
```typescript
import { 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfDay 
} from 'date-fns';

const getDateRange = (option: DateRangeOption) => {
  const today = new Date();
  switch (option) {
    case 'thisWeek':
      // Start of week (Monday) through today
      return { 
        start: startOfWeek(today, { weekStartsOn: 1 }), 
        end: endOfDay(today) 
      };
    case 'lastMonth':
      // Full previous calendar month (closed interval)
      const lastMonthDate = subMonths(today, 1);
      return { 
        start: startOfMonth(lastMonthDate), 
        end: endOfMonth(lastMonthDate) 
      };
    case 'thisMonth':
      return { 
        start: startOfMonth(today), 
        end: endOfDay(today) 
      };
    case 'last3months':
      // 3 calendar months back
      return { 
        start: subMonths(today, 3), 
        end: endOfDay(today) 
      };
    case 'allTime':
      return { 
        start: new Date('2024-01-01'), 
        end: endOfDay(today) 
      };
    default:
      return { 
        start: startOfMonth(today), 
        end: endOfDay(today) 
      };
  }
};
```

### Updated Dropdown Labels
```typescript
<SelectContent>
  <SelectItem value="thisWeek">This Week</SelectItem>
  <SelectItem value="lastMonth">Last Month</SelectItem>
  <SelectItem value="thisMonth">This Month</SelectItem>
  <SelectItem value="last3months">Last 3 Months</SelectItem>
  <SelectItem value="allTime">All Time</SelectItem>
</SelectContent>
```

### Updated Period Label Function
```typescript
const getPeriodLabel = (period: string): string => {
  switch (period) {
    case 'thisWeek': return 'This Week';
    case 'lastMonth': return 'Last Month';
    case 'thisMonth': return 'This Month';
    case 'last3months': return 'Last 3 Months';
    case 'allTime': return 'All Time';
    case 'manual': return 'All Time'; // Backward compatibility
    case 'last7days': return 'Last 7 Days'; // Legacy support
    case 'last30days': return 'Last 30 Days'; // Legacy support
    default: return period;
  }
};
```

---

## Database Compatibility

The `analysis_period` column stores the filter key (e.g., `'thisWeek'`, `'lastMonth'`). Historical records with old values (`'last7days'`, `'last30days'`) will:
- Still display correctly via the legacy labels in `getPeriodLabel()`
- Not appear in filtered lists for new period values (expected behavior)
- Be accessible if user runs a new analysis for that period

No database migration is required.

---

## Expected Results

After implementation:
- **This Week** shows records from Monday through today
- **Last Month** shows the complete previous calendar month (Jan 1-31 for February users)
- **This Month** shows Feb 1 through today
- **Last 3 Months** uses proper calendar month calculation
- **All Time** continues to work as before
- Default filter changes from "Last 30 Days" to "This Month" (most intuitive default)

