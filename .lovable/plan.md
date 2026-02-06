
# Fix Unreadable Recharts Tooltip in "Why They Didn't Book" Chart

## Problem
When hovering over a bar in the chart, the Recharts tooltip displays the full reason text (e.g., "Perceived unfair denial of booking (e.g., host denial before 24-hour window, host not seeing information, previous similar issues)") in a single line that overflows beyond the card boundaries and overlaps with adjacent panels.

## Root Cause
The current Recharts `Tooltip` configuration has `maxWidth: '300px'` in `contentStyle`, but this doesn't enforce text wrapping on the label content. The `labelFormatter` returns the raw `fullReason` string which renders as a single unbroken line.

## Solution
Implement proper text wrapping and constrained width for the Recharts tooltip by using a custom tooltip component instead of inline styles.

### Changes to `src/components/call-insights/NonBookingReasonsChart.tsx`:

1. **Create a custom tooltip component** that properly wraps long text
2. **Apply word-wrap and max-width styles** to ensure content stays within bounds
3. **Improve visual formatting** with clearer structure for reason + frequency data

### Technical Implementation:

```tsx
// Custom tooltip component with proper text wrapping
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  
  const data = payload[0].payload;
  return (
    <div className="bg-popover border rounded-lg shadow-lg p-3 max-w-[280px] z-50">
      <p className="text-sm font-medium text-foreground whitespace-normal break-words mb-1">
        {data.fullReason}
      </p>
      <p className="text-xs text-muted-foreground">
        Frequency: {data.value}% ({data.count} calls)
      </p>
    </div>
  );
};

// In the BarChart, replace:
<Tooltip 
  content={<CustomTooltip />}
  cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
/>
```

### Key Fixes:
- **`whitespace-normal`**: Enables text wrapping
- **`break-words`**: Breaks long words if needed
- **`max-w-[280px]`**: Constrains width within the card
- **Structured layout**: Separates reason text from frequency data for clarity
- **Theme-aware styling**: Uses CSS variables for proper dark/light mode support

This ensures the tooltip remains fully readable within the chart card boundaries regardless of how long the AI-generated reason strings are.
