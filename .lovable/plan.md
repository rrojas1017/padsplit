

## Add Agent Type Column to Agents Tab

The Agents tab now contains both `agent` and `researcher` roles but doesn't visually distinguish them. We'll add a "Type" column showing the role badge.

### Changes

**File: `src/pages/UserManagement.tsx`**

1. **Add a "Type" filter dropdown** next to the existing Site/Status filters in the Agents tab toolbar (around line 906). Options: All Types, Booking Agent, Researcher.

2. **Apply the type filter** in the filtering logic (around line 883-888): filter by `u.role === 'agent'` for "Booking Agent" and `u.role === 'researcher'` for "Researcher".

3. **Add a "Type" column** to the agents table header (around line 949, after "Agent" column).

4. **Add the type cell** in each agent row (around line 986, after the name cell), displaying a colored badge:
   - `agent` role → "Booking Agent" badge (blue)
   - `researcher` role → "Researcher" badge (purple)

5. **Update colspan** values in loading/empty states to account for the new column.

