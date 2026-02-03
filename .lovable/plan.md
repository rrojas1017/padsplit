

## Monthly Pain Point Evolution - Aggregated by Calendar Month

### The Problem

The current evolution chart uses arbitrary analysis dates (Dec 4, Dec 7, Dec 8, etc.) which don't represent meaningful time periods. Most analyses are "All Time" analyses that overlap, making the "evolution" view confusing.

### Proposed Solution

Change the approach from "show each analysis as a data point" to "aggregate all analyses into monthly buckets based on their `date_range_end`":

```text
Current Approach (confusing):
┌──────────────────────────────────────────────────────┐
│ Dec 4  │ Dec 7  │ Dec 8  │ Dec 9  │ Dec 14 │ Dec 21 │  ← arbitrary dates
└──────────────────────────────────────────────────────┘

New Approach (monthly aggregation):
┌──────────────────────────────────────────────────────────────────┐
│   Oct    │   Nov    │   Dec    │   Jan    │   Feb    │          │  ← calendar months
│   2025   │   2025   │   2025   │   2026   │   2026   │          │
└──────────────────────────────────────────────────────────────────┘
```

### How It Works

1. **Fetch all completed analyses** (not just last 10)
2. **Group by month** using `date_range_end` (e.g., all analyses ending in January 2026 → "Jan 2026")
3. **Average pain point frequencies** within each month
4. **Display monthly evolution** with clean month labels on X-axis

### Technical Changes

**File: `src/hooks/usePainPointEvolution.ts`**

Replace the current logic with monthly aggregation:

```typescript
// 1. Fetch more analyses to cover multiple months
const { data: analyses } = await supabase
  .from('member_insights')
  .select('...')
  .eq('status', 'completed')
  .order('date_range_end', { ascending: true })
  .limit(50);

// 2. Group analyses by month (YYYY-MM format)
const monthlyBuckets = new Map<string, {
  month: string;           // e.g., "Jan 2026"
  painPoints: Map<string, number[]>;  // category → [frequencies]
}>();

for (const analysis of analyses) {
  const monthKey = format(new Date(analysis.date_range_end), 'yyyy-MM');
  const monthLabel = format(new Date(analysis.date_range_end), 'MMM yyyy');
  
  // Add each pain point frequency to the month's bucket
  for (const pp of analysis.pain_points) {
    bucket.painPoints.get(category).push(pp.frequency);
  }
}

// 3. Calculate average frequency per category per month
const chartData = monthlyBuckets.map(bucket => ({
  date: bucket.monthLabel,  // "Jan 2026"
  [category]: averageFrequency
}));
```

### UI Changes

**File: `src/components/member-insights/PainPointEvolutionPanel.tsx`**

Update subtitle to reflect monthly aggregation:

```typescript
<p className="text-sm text-muted-foreground mt-1">
  Monthly trends across all historical analyses
</p>
```

### Expected Result

```text
X-axis: Oct 2025 | Nov 2025 | Dec 2025 | Jan 2026 | Feb 2026
```

- Clean monthly labels on X-axis
- Pain point percentages averaged across all analyses that ended in each month
- True month-over-month evolution tracking
- Status badges (Rising, Falling, etc.) compare current month to previous month

### Edge Cases

- **Months with no analyses**: Skip that month (gap in chart)
- **Multiple analyses in same month**: Average their pain point frequencies
- **Future months**: Excluded from aggregation

### Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/usePainPointEvolution.ts` | Replace per-analysis logic with monthly aggregation |
| `src/components/member-insights/PainPointEvolutionPanel.tsx` | Update subtitle text |

