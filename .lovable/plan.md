

# Drag-and-Drop Sidebar Reordering (Super Admin Only)

## Summary
Allow super admins to reorder sidebar items and move them between the Core and Admin sections via drag-and-drop. All other roles see the default static sidebar with zero changes to their experience.

## Safety Guarantees
- The static `menuItems` array (icons, labels, paths, role permissions) is NEVER modified
- Role-based filtering (`hasRole`) always runs first -- drag-and-drop only reorders already-visible items
- Only `super_admin` users see drag handles; other roles are completely unaffected
- Persistence is localStorage only -- no database or schema changes
- If saved order references a removed menu item, it is silently skipped
- If a new menu item is added to code but not in saved order, it appends to its default group
- A "Reset to Default" button lets super admins restore the original order instantly

## Files Changed

### 1. NEW: `src/hooks/useSidebarOrder.ts`
- Custom hook that manages ordered item paths and group assignments
- Reads from `localStorage` key `sidebar-custom-order` on mount; falls back to default `menuItems` order
- Exposes:
  - `getOrderedItems(visibleItems)` -- takes role-filtered items, returns them reordered/regrouped
  - `moveItem(itemPath, targetGroup, targetIndex)` -- handles drop events
  - `resetOrder()` -- clears localStorage, restores defaults
- Merges logic: new code items not in saved order get appended; removed items get dropped

### 2. MODIFIED: `src/components/layout/AppSidebar.tsx`
- Import `useSidebarOrder` hook and `GripVertical` icon from lucide-react
- For super_admin users only:
  - Add `draggable` attribute and HTML5 drag event handlers (`onDragStart`, `onDragOver`, `onDrop`) to each nav item wrapper
  - Show a subtle grip handle icon on hover (left of the menu icon)
  - Show a gold insertion line on the current drop target
  - Add a small "Reset order" text button below the nav items
- For non-super_admin users: zero changes -- same static rendering as today
- When sidebar is collapsed: drag is disabled (too narrow for handles)
- Core logic flow:
  1. `visibleItems = menuItems.filter(hasRole)` (unchanged)
  2. `orderedItems = getOrderedItems(visibleItems)` (new -- applies saved order)
  3. Split into `coreItems` / `adminItems` from `orderedItems` (unchanged pattern)

### 3. MODIFIED: `src/index.css`
- Add two small utility classes (~4 lines):
  - `.sidebar-drag-over` -- gold left border or insertion line indicator
  - `.sidebar-dragging` -- reduced opacity on the dragged item

## How It Works

```text
Default sidebar (all roles)     Super Admin with drag enabled
+------------------------+      +-----------------------------+
| Dashboard              |      | [=] Dashboard               |
| Add Booking            |      | [=] Add Booking             |
| Agent Leaderboard      |      | [=] Agent Leaderboard       |
| ...                    |      | ...                         |
| Market Intelligence    |  --> | [=] Market Intelligence  <--drag down
|                        |      |                             |
| v Admin                |      | v Admin                     |
|   Communication Insigh |      |   Communication Insights    |
|   User Management      |      |   User Management           |
|   ...                  |      |   Market Intelligence  <--dropped here
|                        |      |   ...                       |
|                        |      | [Reset to default]          |
+------------------------+      +-----------------------------+

[=] = grip handle (visible on hover, super_admin only)
```

## No Impact on Other Features
- Route definitions in `App.tsx`: untouched
- `ProtectedRoute` access control: untouched
- `AuthContext` and role checking: untouched
- Admin collapsible section behavior: preserved (auto-expand on active route still works)
- Sidebar collapse/expand toggle: preserved
- All other user roles: see identical sidebar to current behavior

