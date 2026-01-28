

## Plan: Add Cost Breakdown Section to Dashboard

### Overview
Add a cost overview section on the Executive Dashboard that shows API processing costs for the selected date range. This gives super admins visibility into processing costs without navigating to the Billing page.

---

### Changes Required

#### 1. Integrate `useBillingData` Hook into Dashboard
**File: `src/pages/Dashboard.tsx`**

Import and use the billing data hook, converting the date range format:

```typescript
import { useBillingData } from '@/hooks/useBillingData';
import { formatCurrency } from '@/utils/billingCalculations';
import { DollarSign, Timer, FileCheck, TrendingDown } from 'lucide-react';

// Convert DateRangeFilter value to useBillingData format
const getBillingDateRange = (range: DateRangeFilterType): 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'last30Days' | 'allTime' | 'custom' => {
  switch (range) {
    case 'today': return 'today';
    case 'yesterday': return 'yesterday';
    case 'last7Days': return 'thisWeek';
    case 'last30Days': return 'last30Days';
    case 'thisMonth': return 'thisMonth';
    case 'allTime': return 'allTime';
    case 'custom': return 'custom';
    default: return 'today';
  }
};

const { summary: costSummary, costs, isLoading: costsLoading, isSuperAdmin } = useBillingData(
  getBillingDateRange(dateRange),
  customDates?.start,
  customDates?.end
);
```

---

#### 2. Add Cost Breakdown Cards Section (Super Admin Only)
**File: `src/pages/Dashboard.tsx`**

Add a new section below the Insights panel, visible only to super admins:

```jsx
{/* Cost Breakdown - Super Admin Only */}
{isSuperAdmin && (
  <div className="mt-6 p-6 rounded-xl bg-card border border-border animate-slide-up" style={{ animationDelay: '600ms' }}>
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <DollarSign className="w-5 h-5 text-accent" />
        Cost Breakdown
      </h3>
      <a href="/billing" className="text-sm text-primary hover:underline">
        View Full Billing →
      </a>
    </div>
    
    {costsLoading ? (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    ) : (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Cost */}
        <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-primary" />
            <p className="text-xs text-muted-foreground font-medium uppercase">Total Cost</p>
          </div>
          <p className="text-xl font-bold text-primary">{formatCurrency(costSummary.totalCost)}</p>
          <p className="text-xs text-muted-foreground">{costs.length} API calls</p>
        </div>
        
        {/* Bookings Processed */}
        <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
          <div className="flex items-center gap-2 mb-1">
            <FileCheck className="w-4 h-4 text-accent" />
            <p className="text-xs text-muted-foreground font-medium uppercase">Processed</p>
          </div>
          <p className="text-xl font-bold text-accent">{costSummary.uniqueBookingsProcessed}</p>
          <p className="text-xs text-muted-foreground">bookings analyzed</p>
        </div>
        
        {/* Talk Time */}
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-center gap-2 mb-1">
            <Timer className="w-4 h-4 text-amber-500" />
            <p className="text-xs text-muted-foreground font-medium uppercase">Talk Time</p>
          </div>
          <p className="text-xl font-bold text-amber-500">
            {Math.round(costSummary.totalTalkTimeSeconds / 60)}m
          </p>
          <p className="text-xs text-muted-foreground">audio transcribed</p>
        </div>
        
        {/* Cost per Booking */}
        <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-purple-500" />
            <p className="text-xs text-muted-foreground font-medium uppercase">Per Booking</p>
          </div>
          <p className="text-xl font-bold text-purple-500">
            {costSummary.uniqueBookingsProcessed > 0 
              ? formatCurrency(costSummary.costPerBooking) 
              : '—'}
          </p>
          <p className="text-xs text-muted-foreground">avg processing cost</p>
        </div>
      </div>
    )}
  </div>
)}
```

---

#### 3. Update Loading Skeleton
**File: `src/pages/Dashboard.tsx`**

Add skeleton for cost section in loading state (for super admins):

```jsx
{isSuperAdmin && <Skeleton className="h-32 rounded-xl mt-6" />}
```

---

### Visual Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Executive Dashboard                                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  [Date Filter] [Site Filter]                         Last updated: 2:30 PM  │
├──────────────────┬──────────────────┬──────────────────┬────────────────────┤
│  Total Bookings  │  Active Agents   │  Avg per Day     │  Pending Move-ins  │
│       45         │       12         │      3.8         │       8            │
└──────────────────┴──────────────────┴──────────────────┴────────────────────┘

┌─────────────────────────────────────────┬───────────────────────────────────┐
│  Bookings Trend Chart                   │  Market Distribution              │
└─────────────────────────────────────────┴───────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  Agent Leaderboard                                                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  Today's Insights                                                           │
│  [5 insight cards]                                                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  💰 Cost Breakdown                                    View Full Billing →   │
├──────────────────┬──────────────────┬──────────────────┬────────────────────┤
│  Total Cost      │   Processed      │   Talk Time      │  Per Booking       │
│    $12.47        │      28          │     156m         │    $0.45           │
│  342 API calls   │ bookings analyzed│ audio transcribed│ avg processing     │
└──────────────────┴──────────────────┴──────────────────┴────────────────────┘
   ⬆️ Only visible to Super Admins
```

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Dashboard.tsx` | Import `useBillingData` hook, add cost breakdown section (super admin only), add skeleton loading state |

---

### Result
Super admins will see a cost breakdown section at the bottom of the Dashboard showing:
- **Total Cost**: Total API processing costs for the period
- **Processed**: Number of unique bookings that were processed
- **Talk Time**: Total audio minutes transcribed
- **Per Booking**: Average cost per booking processed

The section includes a link to the full Billing page for detailed analysis. Regular admins and agents won't see this section.

