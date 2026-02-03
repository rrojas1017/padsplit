

## Add Rebooking Metrics to Main Dashboard

### Overview

Add rebooking tracking to the main dashboard KPI cards so users can see the total bookings breakdown between new bookings and rebookings at a glance.

### Current vs. Proposed Layout

```text
CURRENT KPI Cards:
┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│ Total Bookings │ │ Vixicom        │ │ PadSplit       │ │ Pending        │
│     15         │ │     12         │ │      3         │ │ Move-Ins: 8    │
└────────────────┘ └────────────────┘ └────────────────┘ └────────────────┘

PROPOSED KPI Cards (5 cards):
┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│ Total Bookings │ │ Rebookings     │ │ Vixicom        │ │ PadSplit       │ │ Pending        │
│     15         │ │      3         │ │     12         │ │      3         │ │ Move-Ins: 8    │
│ (12 new, 3 re) │ │  20% of total  │ │                │ │                │ │                │
└────────────────┘ └────────────────┘ └────────────────┘ └────────────────┘ └────────────────┘
```

### Implementation Steps

#### Step 1: Update KPI Calculation to Include Rebooking Data

**File: `src/utils/dashboardCalculations.ts`**

Modify `calculateKPIData` to track rebookings:

```typescript
// Add to current calculations (around line 100-122)
const currentNewBookings = currentBookings.filter(b => !b.isRebooking).length;
const currentRebookings = currentBookings.filter(b => b.isRebooking).length;
const previousNewBookings = previousBookings.filter(b => !b.isRebooking).length;
const previousRebookings = previousBookings.filter(b => b.isRebooking).length;

const rebookingsChange = calculateChange(currentRebookings, previousRebookings);

// Update first KPI card label to include breakdown
// Label: "Total Bookings" 
// Add subtitle info showing: "X new, Y rebookings"

// Add new rebookings KPI card
{
  label: 'Rebookings',
  value: currentRebookings,
  previousValue: previousRebookings,
  change: rebookingsChange.change,
  changeType: rebookingsChange.changeType,
  comparisonLabel,
}
```

#### Step 2: Enhance KPIData Type for Subtitle

**File: `src/types/index.ts`**

Add optional subtitle field to KPIData:

```typescript
export interface KPIData {
  label: string;
  value: number;
  previousValue: number;
  change: number;
  changeType: 'increase' | 'decrease' | 'neutral';
  comparisonLabel?: string;
  subtitle?: string;  // NEW: For additional context like "12 new, 3 rebookings"
}
```

#### Step 3: Update KPICard Component to Show Subtitle

**File: `src/components/dashboard/KPICard.tsx`**

Add subtitle rendering:

```typescript
interface KPICardProps {
  data: KPIData;
  icon?: React.ReactNode;
  delay?: number;
}

// In the component, after the main value:
{data.subtitle && (
  <p className="text-xs text-muted-foreground mt-0.5">
    {data.subtitle}
  </p>
)}
```

#### Step 4: Update Dashboard Grid for 5 Cards

**File: `src/pages/Dashboard.tsx`**

Update the KPI grid to handle 5 cards and add a new icon:

```typescript
// Add Repeat icon for rebookings
import { CalendarDays, Users, Clock, CheckCircle2, Repeat } from 'lucide-react';

const kpiIcons = [
  <CalendarDays className="w-5 h-5" />,  // Total Bookings
  <Repeat className="w-5 h-5" />,         // Rebookings (NEW)
  <Users className="w-5 h-5" />,          // Vixicom
  <Clock className="w-5 h-5" />,          // PadSplit
  <CheckCircle2 className="w-5 h-5" />,   // Pending Move-Ins
];

// Update grid to use 5 columns on large screens
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
```

### Technical Details

#### Rebooking Calculation Logic

Uses existing `isRebooking` boolean field on bookings:
- **New Booking**: `isRebooking === false` or `isRebooking === undefined`
- **Rebooking**: `isRebooking === true`

The same-time comparison logic (for "Today" filter) will apply to rebooking counts as well.

#### Subtitle Format

For Total Bookings card:
- If rebookings > 0: `"X new, Y rebookings"`
- If rebookings = 0: `"All new bookings"`

### Files to Modify

| File | Changes |
|------|---------|
| `src/types/index.ts` | Add `subtitle?: string` to `KPIData` interface |
| `src/utils/dashboardCalculations.ts` | Add rebooking calculations, add new KPI card, add subtitle to Total Bookings |
| `src/components/dashboard/KPICard.tsx` | Render subtitle below value if present |
| `src/pages/Dashboard.tsx` | Update grid to 5 columns, add Repeat icon |

### Expected Result

| Metric | Display |
|--------|---------|
| Total Bookings | Shows count with subtitle "12 new, 3 rebookings" |
| Rebookings | Dedicated card with count and period comparison |
| Comparison | Both cards show % change vs previous period |

