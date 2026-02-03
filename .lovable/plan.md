

## Fix Pain Point Evolution Chart - Date Display & Clarity

### Problems Identified

1. **Wrong date source**: Currently using `created_at` (when analysis ran) instead of `date_range_end` (what period was analyzed)
2. **Duplicate dates**: Multiple analyses were run on the same day (e.g., 5 on Dec 5), creating repeated X-axis labels
3. **No context**: Users don't understand this chart is independent from the date filter above

### Solution

**Phase 1: Use Analysis Period End Date**

**File: `src/hooks/usePainPointEvolution.ts`**

Change the date displayed from `created_at` to `date_range_end`:

```typescript
// Line 135-138: Change from created_at to date_range_end
const date = new Date(analysis.date_range_end).toLocaleDateString('en-US', { 
  month: 'short', 
  day: 'numeric' 
});
```

This makes the X-axis show the period being analyzed (e.g., "Dec 8" = analysis of data ending Dec 8).

**Phase 2: Deduplicate by Date Range**

When multiple analyses exist for the same date range, use only the most recent one:

```typescript
// After fetching analyses, deduplicate by date_range_end
const deduplicatedAnalyses = new Map<string, typeof analyses[0]>();
for (const analysis of analyses) {
  const key = `${analysis.date_range_start}_${analysis.date_range_end}`;
  // Keep the latest analysis for each unique date range
  deduplicatedAnalyses.set(key, analysis);
}
const uniqueAnalyses = Array.from(deduplicatedAnalyses.values())
  .sort((a, b) => new Date(a.date_range_end).getTime() - new Date(b.date_range_end).getTime());
```

**Phase 3: Add Descriptive Subtitle**

**File: `src/components/member-insights/PainPointEvolutionPanel.tsx`**

Add a subtitle explaining the chart's scope:

```typescript
<CardHeader>
  <div className="flex items-center justify-between">
    <div>
      <CardTitle className="flex items-center gap-2">
        <LineChartIcon className="h-5 w-5" />
        Pain Point Evolution
      </CardTitle>
      <p className="text-sm text-muted-foreground mt-1">
        Tracking across last {chartData.length} analyses (all periods)
      </p>
    </div>
    // ... help tooltip
  </div>
</CardHeader>
```

**Phase 4: Improve Tooltip Context**

Show the full date range in the chart tooltip:

```typescript
// Store full date range info in chart data
interface ChartDataPoint {
  date: string;
  dateRange: string; // e.g., "Nov 8 - Dec 8"
  [category: string]: string | number;
}

// In RechartsTooltip, show the date range
<RechartsTooltip
  labelFormatter={(label, payload) => {
    const point = payload?.[0]?.payload;
    return point?.dateRange || label;
  }}
  // ...
/>
```

### Expected Result

**Before:**
```
X-axis: Dec 5 | Dec 5 | Dec 5 | Dec 5 | Dec 5 | Dec 8 | Dec 9 | ...
```

**After:**
```
X-axis: Dec 5 | Dec 8 | Dec 9 | Dec 10 | Dec 15 | Dec 22 | Dec 30 | Jan 12
Subtitle: "Tracking across last 8 analyses (all periods)"
Tooltip: "Nov 8 - Dec 8" with pain point percentages
```

### Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/usePainPointEvolution.ts` | Use `date_range_end`, deduplicate by period, add date range context |
| `src/components/member-insights/PainPointEvolutionPanel.tsx` | Add subtitle, improve tooltip |

### Technical Notes

- Sort by `date_range_end` to get chronological order of analyzed periods
- Deduplication keeps the latest analysis when multiple exist for the same period
- The evolution chart intentionally spans ALL analyses regardless of the current date filter—this is correct behavior for showing long-term trends

