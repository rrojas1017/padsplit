

# Fix: Treemap Sub-Reason Click → Drill-Down

## Problem
Clicking on a treemap block in the Sub-Reason Distribution chart doesn't reliably open the drill-down panel showing the actual records. The Recharts `<Treemap onClick>` handler doesn't fire consistently when a custom `content` renderer is used — the SVG `<g>` element in `CustomTreemapContent` intercepts the click before it reaches the Treemap component.

## Solution
Move the click handling **into** the `CustomTreemapContent` component by passing an `onBlockClick` callback as a prop. The `<rect>` element already has `cursor: pointer` but no click handler — we add one directly.

## Change

| File | Change |
|------|--------|
| `src/components/research-insights/ReasonCodeChart.tsx` | 1) Add `onBlockClick` prop to `CustomTreemapContent` and attach it to the `<g>` element's `onClick`; 2) Pass the drill-down logic as `onBlockClick` when rendering `<Treemap content={...}>` |

Specifically:
- `CustomTreemapContent` receives `onBlockClick?: (name: string) => void` via props and calls it on `<g onClick>`
- The `<Treemap>` renders `content={<CustomTreemapContent onBlockClick={handleTreemapClick} />}` where `handleTreemapClick` builds the booking IDs and opens `setSubReasonDrillDown`
- Keep the existing `<Treemap onClick>` as a fallback

This is a single-file change affecting ~10 lines.

