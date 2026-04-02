

# Fix Sub-Category Drill-Down: Open as Sheet Instead of Inline Filter

## Problem
Clicking a sub-category row (e.g. "Buying a Home") in the ReasonDrillDown currently sets an inline `treemapFilter` that just filters the member list below — pushing rows around and showing 0 members when the filter doesn't match. It should open a **separate Sheet panel** (slide-out from right) showing that sub-reason's members, exactly like clicking a reason code cluster on the main overview opens a full drill-down.

## Solution
When a sub-category row is clicked, open the existing `ReasonCodeDrillDown` Sheet component (already built in `src/components/research-insights/ReasonCodeDrillDown.tsx`) — passing the sub-reason name and filtered booking IDs. Keep the treemap click and checkbox multi-select for export purposes only.

## Changes

### `src/components/research-insights/ReasonCodeChart.tsx`

**In `ReasonDrillDown`:**
1. Add state: `subReasonDrillDown: { name: string; bookingIds: string[] } | null`
2. Change sub-reason table row `onClick` — instead of setting `treemapFilter`, collect booking IDs for that sub-reason from `allMembers` and open the `ReasonCodeDrillDown` Sheet
3. Change treemap block click — same behavior: open the Sheet for that sub-reason
4. Keep checkboxes for multi-select export (they don't open the sheet, they populate the floating action bar)
5. Import and render `ReasonCodeDrillDown` at the bottom of `ReasonDrillDown`, passing the sub-reason name, color, and booking IDs
6. Remove `treemapFilter` state and all inline filtering tied to it — the member preview section goes back to showing all members (or selected-checkbox members for export)

**Result:** Clicking a sub-reason row or treemap block opens the familiar Sheet with member list, clickable rows for `MemberDetailPanel`, search, and CSV export — matching the pattern users already know from the top-level reason code clicks.

### Files
| File | Action |
|------|--------|
| `src/components/research-insights/ReasonCodeChart.tsx` | Replace inline treemap filter with Sheet-based drill-down |

