

## Add User Search to User Management

### Problem
The User Management page has no search functionality, making it difficult to find specific users when the list grows large.

### Plan

**Add a search input** to both the "Non-Agents" and "Agents" tabs that filters users by name or email in real-time (client-side filtering).

### Changes to `src/pages/UserManagement.tsx`

1. **Add search state**: Add a `searchQuery` state variable at the top of the component alongside existing state.

2. **Add search input UI**: In the header area of each tab (lines ~659-670 for Non-Agents, and the equivalent area in the Agents tab), add a search `Input` with a `Search` icon, placed between the count text and the "Add User" button.

3. **Filter users by search**: Apply the search filter to the `nonAgentUsers` list and the `agents` list before rendering, matching against `name` and `email` (case-insensitive). The displayed count will reflect filtered results.

### Technical Details

- Import `Search` from `lucide-react` (already imported in `Header.tsx` pattern)
- Single `searchQuery` state shared across both tabs, or separate per tab — will use a single state that resets when switching tabs for simplicity
- Filter logic: `user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query)`
- For the Agents tab, filter on `agent.name` and linked user email if available
- No database changes needed — purely client-side filtering

