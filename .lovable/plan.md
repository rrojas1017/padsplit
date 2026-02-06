
# Fix "Why They Didn't Book" Chart Readability

## Problem Identified
The chart's Y-axis labels are showing extremely long reason strings (50-150+ characters each) that overlap and become completely unreadable. Examples of actual data:
- "Perceived unfair denial of booking (e.g., host denial before 24-hour window, host not seeing information...)"
- "Financial constraints or timing (e.g., insufficient funds, waiting for payday, cannot afford initial payment...)"

The current implementation has:
- Fixed Y-axis width of 120px (far too narrow)
- No text truncation or word wrapping
- 6 bars trying to display simultaneously with 11px font

## Solution Approach
Redesign the chart to handle long category labels gracefully using a **legend-based approach** instead of inline Y-axis labels.

### Design Changes:
1. **Replace Y-axis text labels with numbered categories** - Use "1", "2", "3"... or short codes on the Y-axis
2. **Add a legend below the chart** - Show the full reason text with truncation and tooltips for accessibility
3. **Increase chart height** - Give more breathing room for bar spacing
4. **Truncate long reason text** - Cap at ~60 characters with "..." and show full text on hover
5. **Limit to top 5 reasons** - Focus on most impactful data

### Visual Layout:
```text
+------------------------------------------+
|  Why They Didn't Book                    |
+------------------------------------------+
|                                          |
|  1 ████████████████████  35%             |
|  2 ████████████████  30%                 |
|  3 ██████████████  25%                   |
|  4 ████████  15%                         |
|  5 ██████  10%                           |
|                                          |
+------------------------------------------+
|  Legend:                                 |
|  1. Financial constraints or timing...   |
|  2. Lack of suitable or available...     |
|  3. Perceived unfair denial of booking...|
|  4. Hesitation or inability to complete..|
|  5. System/Process issues...             |
+------------------------------------------+
```

---

## Technical Details

### File to Modify
`src/components/call-insights/NonBookingReasonsChart.tsx`

### Changes:
1. **Transform data** - Assign a short index label to each reason
2. **Reduce Y-axis width** to ~30px for numeric labels
3. **Add a scrollable legend component** below the chart with:
   - Colored indicator matching bar color
   - Truncated reason text (60 chars max)
   - Hover tooltip showing full text
   - Call count badge
4. **Reduce bars displayed** from 6 to 5 for cleaner presentation
5. **Increase container height** to accommodate legend (~380px total)

### Component Structure:
```tsx
<Card>
  <CardHeader>...</CardHeader>
  <CardContent>
    <div className="h-[200px]">  {/* Chart area */}
      <BarChart with numeric Y-axis labels />
    </div>
    <div className="mt-4 space-y-2">  {/* Legend area */}
      {chartData.map((item, idx) => (
        <div className="flex items-center gap-2">
          <span className="shrink-0 font-mono">{idx + 1}.</span>
          <div className="h-3 w-3 rounded" style={{ bg: color }} />
          <span className="truncate text-sm" title={fullText}>
            {truncatedText}
          </span>
          <Badge>{percentage}%</Badge>
        </div>
      ))}
    </div>
  </CardContent>
</Card>
```

This approach ensures readability regardless of how long the AI-generated reason strings are, while maintaining the visual hierarchy and color coding of the original chart.
