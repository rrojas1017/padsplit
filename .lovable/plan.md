
# Fix Pie Chart Label Overlapping in LLM Cost Calculator

## Problem
The pie chart in the LLM Cost Calculator has overlapping labels when there are many small percentage slices. As shown in the screenshot, when STT is 96% and other categories (LLM Analysis 2%, AI Polish 2%, QA Scoring, Speaker ID 0%) are small, their labels overlap and become unreadable.

## Solution
Remove inline labels from the pie chart and use a custom legend that displays both the category name and percentage. This is the standard approach for pie charts with many small slices.

## Changes to Make

### File: `src/components/billing/LLMCostCalculator.tsx`

**Current Implementation (Lines 443-459)**:
```tsx
<Pie
  data={calculations.breakdown}
  dataKey="value"
  nameKey="name"
  cx="50%"
  cy="50%"
  outerRadius={80}
  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
>
```

**New Implementation**:
1. Remove the `label` prop from `<Pie>` to stop inline labels
2. Add `labelLine={false}` to ensure no label lines are rendered
3. Create a custom `renderLegend` function that displays each category with:
   - Color indicator
   - Category name
   - Cost value
   - Percentage
4. Update the `<Legend>` component to use the custom renderer
5. Make the chart slightly larger to accommodate the improved legend

**Visual Result**:
- Clean pie chart without overlapping text
- Legend below showing all categories with their values
- Tooltip still shows details on hover

### Technical Details

**Custom Legend Renderer**:
```tsx
const renderLegend = (props: any) => {
  const { payload } = props;
  const total = calculations.breakdown.reduce((sum, item) => sum + item.value, 0);
  
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2 text-xs">
      {payload.map((entry: any, index: number) => {
        const item = calculations.breakdown.find(b => b.name === entry.value);
        const percent = total > 0 ? ((item?.value || 0) / total * 100) : 0;
        return (
          <div key={`legend-${index}`} className="flex items-center gap-1">
            <span 
              className="w-3 h-3 rounded-sm" 
              style={{ backgroundColor: entry.color }} 
            />
            <span>{entry.value}</span>
            <span className="text-muted-foreground">
              {formatCurrency(item?.value || 0)} ({percent.toFixed(0)}%)
            </span>
          </div>
        );
      })}
    </div>
  );
};
```

**Updated Pie Component**:
```tsx
<Pie
  data={calculations.breakdown}
  dataKey="value"
  nameKey="name"
  cx="50%"
  cy="50%"
  outerRadius={80}
  labelLine={false}
>
  {calculations.breakdown.map((entry, index) => (
    <Cell key={`cell-${index}`} fill={entry.color} />
  ))}
</Pie>
<Tooltip formatter={(value: number) => formatCurrency(value)} />
<Legend content={renderLegend} />
```

## Summary of Changes

| Location | Change |
|----------|--------|
| Line 451 | Remove `label` prop from `<Pie>` |
| Line 451 | Add `labelLine={false}` prop |
| Lines 456-458 | Replace `<Legend />` with `<Legend content={renderLegend} />` |
| Before return | Add `renderLegend` function for custom legend with percentages and values |

This approach follows the same pattern used elsewhere in the app (like NonBookingReasonsChart) where complex labels are moved to a legend format to avoid overlapping issues.
