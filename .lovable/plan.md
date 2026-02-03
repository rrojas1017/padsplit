

## Add Interactive Legend Toggle to Pain Point Evolution Chart

### Overview

Add the ability to click on pain point legend items to show/hide their corresponding chart lines. This allows users to focus on specific pain points without visual clutter from others.

### How It Will Work

```text
Before (all lines visible):
┌─────────────────────────────────────┐
│  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~     │
│     ~~~~~~~~~~~~~~~~~~~~~~~~        │
│  ~~~~    ~~~~~    ~~~~~~            │
└─────────────────────────────────────┘
 [●] Payment Confusion  [●] Housing Concerns  [●] Process Clarity

After clicking "Housing Concerns":
┌─────────────────────────────────────┐
│  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~     │
│                                     │  ← Housing line hidden
│  ~~~~    ~~~~~    ~~~~~~            │
└─────────────────────────────────────┘
 [●] Payment Confusion  [○] Housing Concerns  [●] Process Clarity
                         (faded/struck-through)
```

### Implementation Details

**File: `src/components/member-insights/PainPointEvolutionPanel.tsx`**

1. Add state to track which categories are visible
2. Replace Recharts `<Legend />` with custom clickable legend
3. Conditionally hide `<Line />` components based on visibility state

### Technical Details

**State Management:**
```typescript
// Track hidden categories (empty = all visible)
const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());

// Toggle function
const toggleCategory = (category: string) => {
  setHiddenCategories(prev => {
    const next = new Set(prev);
    if (next.has(category)) {
      next.delete(category);
    } else {
      next.add(category);
    }
    return next;
  });
};
```

**Custom Legend Component:**
```typescript
// Interactive legend below the chart
<div className="flex flex-wrap justify-center gap-3 mt-4">
  {categories.map((cat, index) => {
    const isHidden = hiddenCategories.has(normalizedCategories[index]);
    return (
      <button
        key={cat}
        onClick={() => toggleCategory(normalizedCategories[index])}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all",
          isHidden 
            ? "opacity-40 line-through border-dashed" 
            : "opacity-100 hover:bg-muted"
        )}
      >
        <span 
          className="w-3 h-3 rounded-full" 
          style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
        />
        <span className="text-sm">{cat}</span>
      </button>
    );
  })}
</div>
```

**Conditional Line Rendering:**
```typescript
{normalizedCategories.map((cat, index) => {
  // Skip hidden categories
  if (hiddenCategories.has(cat)) return null;
  
  return (
    <Line
      key={cat}
      type="monotone"
      dataKey={cat}
      name={categories[index]}
      stroke={CHART_COLORS[index % CHART_COLORS.length]}
      strokeWidth={2}
      dot={{ r: 4 }}
      activeDot={{ r: 6 }}
      connectNulls
    />
  );
})}
```

### Visual Design

| State | Appearance |
|-------|------------|
| Visible | Solid border, full opacity, colored dot |
| Hidden | Dashed border, 40% opacity, line-through text |
| Hover (visible) | Light background highlight |

### User Experience

- Click any legend item to toggle its visibility
- Hidden items appear faded with strikethrough text
- Click again to restore visibility
- All items visible by default on component load
- Visual feedback on hover to indicate clickability

### File to Modify

| File | Changes |
|------|---------|
| `src/components/member-insights/PainPointEvolutionPanel.tsx` | Add `hiddenCategories` state, replace `<Legend />` with custom interactive legend, conditionally render `<Line />` components |

