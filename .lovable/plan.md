

## Fix TrendChart to Fetch Historical Data Independently

### Overview

The TrendChart currently receives its data as a prop from BookingInsightsTab, which filters analyses by the selected period (e.g., "Last 7 Days"). This means when only 1 analysis exists for that period, the chart shows "Run more analyses to see trends" even though historical analyses exist in the database.

The fix will make TrendChart self-sufficient by creating a dedicated hook (similar to `usePainPointEvolution`) that fetches ALL historical analyses independently and includes its own time range filter dropdown.

### Current vs. Proposed Flow

```text
CURRENT:
┌─────────────────────────────────────────────────────────────────┐
│ BookingInsightsTab                                              │
│   ├─ dateRange filter: "Last 7 Days"                            │
│   ├─ fetches insights filtered by period                        │
│   └─ passes filtered insights to TrendChart                     │
│        └─ Shows "Need 2+ analyses" if only 1 match              │
└─────────────────────────────────────────────────────────────────┘

PROPOSED:
┌─────────────────────────────────────────────────────────────────┐
│ BookingInsightsTab                                              │
│   └─ TrendChart (self-contained)                                │
│        ├─ Own time range dropdown: [Last 6 months ▼]            │
│        ├─ useSentimentTrends hook fetches independently         │
│        └─ Always shows data if historical analyses exist        │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Steps

#### Step 1: Create useSentimentTrends Hook

**New File: `src/hooks/useSentimentTrends.ts`**

This hook will:
- Accept a `TimeRangeOption` parameter (`'3m' | '6m' | '12m' | 'all'`)
- Fetch completed analyses from `member_insights` filtered by `date_range_end`
- Return chart-ready data with sentiment distributions over time
- Group multiple analyses on the same date intelligently

```typescript
export type TimeRangeOption = '3m' | '6m' | '12m' | 'all';

interface SentimentDataPoint {
  date: string;
  fullDate: string;
  dateRange: string;
  calls: number;
  positive: number;
  neutral: number;
  negative: number;
}

interface UseSentimentTrendsResult {
  chartData: SentimentDataPoint[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useSentimentTrends(timeRange: TimeRangeOption = '6m'): UseSentimentTrendsResult {
  // Calculate cutoff date based on timeRange
  // Query member_insights with date filter
  // Process and format data for chart
}
```

Key query logic:
```typescript
let query = supabase
  .from('member_insights')
  .select('id, created_at, date_range_start, date_range_end, total_calls_analyzed, sentiment_distribution, status')
  .eq('status', 'completed')
  .order('date_range_end', { ascending: true });

if (cutoffDate) {
  query = query.gte('date_range_end', cutoffDate.toISOString());
}

const { data } = await query.limit(50);
```

#### Step 2: Update TrendChart Component

**Modified File: `src/components/member-insights/TrendChart.tsx`**

Changes:
- Remove `insights` prop dependency
- Add internal state for `timeRange`
- Use new `useSentimentTrends` hook
- Add time range dropdown to card header

```typescript
import { useSentimentTrends, TimeRangeOption } from '@/hooks/useSentimentTrends';

const TrendChart = () => {
  const [timeRange, setTimeRange] = useState<TimeRangeOption>('6m');
  const { chartData, isLoading, error, refetch } = useSentimentTrends(timeRange);

  // Render dropdown in CardHeader:
  <CardHeader className="flex flex-row items-center justify-between">
    <CardTitle>...</CardTitle>
    <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRangeOption)}>
      <SelectTrigger className="w-[140px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="3m">Last 3 months</SelectItem>
        <SelectItem value="6m">Last 6 months</SelectItem>
        <SelectItem value="12m">Last 12 months</SelectItem>
        <SelectItem value="all">All time</SelectItem>
      </SelectContent>
    </Select>
  </CardHeader>
};
```

#### Step 3: Update BookingInsightsTab Usage

**Modified File: `src/components/call-insights/BookingInsightsTab.tsx`**

Change line 474 from:
```typescript
<TrendChart insights={insights} />
```
To:
```typescript
<TrendChart />
```

The component no longer needs to pass data - TrendChart is now self-sufficient.

### Technical Details

#### Data Processing in useSentimentTrends

1. **Date Filtering**: Apply `subMonths()` from date-fns based on selected time range
2. **Deduplication**: Handle multiple analyses on the same day by showing time in labels
3. **Empty State**: Return empty array if no analyses found (chart will show appropriate message)
4. **Loading State**: Provide loading indicator while fetching

#### Chart Data Structure

```typescript
{
  date: 'Jan 30',        // Or 'Jan 30 4pm' if multiple same-day
  fullDate: 'Jan 30, 2025 4:00 PM',
  dateRange: 'Jan 23 - Jan 30',
  calls: 150,
  positive: 45,
  neutral: 35,
  negative: 20
}
```

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/hooks/useSentimentTrends.ts` | Create | New hook for independent data fetching with time filtering |
| `src/components/member-insights/TrendChart.tsx` | Modify | Remove prop dependency, add hook usage and dropdown |
| `src/components/call-insights/BookingInsightsTab.tsx` | Modify | Remove insights prop from TrendChart usage |

### Expected Result

| Scenario | Before | After |
|----------|--------|-------|
| "Last 7 Days" filter, 1 analysis | Shows "Run more analyses" | Shows trend from last 6 months of analyses |
| New project, 0 analyses | Shows "Run more analyses" | Shows "Run more analyses" (correct) |
| Any filter, 10+ historical analyses | May show partial data | Shows all historical trends with own filter |

