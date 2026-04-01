

# Fix Issues & Root Causes Tab

The tab is already wired up and functional. The plan focuses on styling alignment and the priority prefix stripping per the spec.

## Changes

### 1. `src/components/research-insights/IssueClustersPanel.tsx` — Restyle to match spec
- Switch from custom Collapsible to shadcn **Accordion** (`type="multiple"`, `defaultValue` set to first 2 items)
- Header: Show PriorityBadge on the left, then the cluster name **without** the "P0: " prefix (strip it)
- Quote styling: change from `bg-accent/40` to `bg-red-50 border-l-3 border-red-300` with italic text
- Show max 3 quotes by default with a "Show more" toggle if more exist
- Recommended action box: `bg-blue-50 border-l-4 border-blue-500` with bold "Recommended Action" heading

### 2. `src/components/research-insights/TopActionsTable.tsx` — Strip priority prefix from action text
- In the Action column, remove leading "P0: ", "P1: ", "P2: " prefixes from `row.action` since priority is already shown in its own column
- No structural changes needed — the 3-column layout (Priority, Action, Quick Win) is already correct

### 3. `src/components/research-insights/BlindSpotsPanel.tsx` — Restyle to match spec
- Replace numbered circles with `AlertTriangle` icon (text-amber-500)
- Change card background to `bg-amber-50` with rounded border
- Bold the `blind_spot` text, show `description` as smaller body text below

### Files
| File | Action |
|------|--------|
| `src/components/research-insights/IssueClustersPanel.tsx` | Rewrite with Accordion, new quote/action styling |
| `src/components/research-insights/TopActionsTable.tsx` | Strip priority prefix from action text |
| `src/components/research-insights/BlindSpotsPanel.tsx` | Restyle with AlertTriangle and amber background |

