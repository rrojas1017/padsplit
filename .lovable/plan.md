

## Add Filters to User Management

### Current State
The User Management page has two tabs (Non-Agents and Agents) with a text search by name/email. No filters for role, site, or status exist.

### Plan

**File: `src/pages/UserManagement.tsx`**

1. **Add filter state variables** (around line 107):
   - `roleFilter: string` (default `'all'`) — filter by role
   - `siteFilter: string` (default `'all'`) — filter by site
   - `statusFilter: string` (default `'all'`) — filter by status (active/inactive)

2. **Add filter dropdowns to the Non-Agents tab toolbar** (around line 668-681):
   - Role filter: Select with options All, Super Admin, Admin, Supervisor, Researcher
   - Site filter: Select populated from `sites` state
   - Status filter: Select with Active / Inactive

3. **Add filter dropdowns to the Agents tab toolbar** (around line 840-854):
   - Site filter: Select populated from `sites` state
   - Status filter: Select with Active / Inactive

4. **Update filtering logic** in both tabs' IIFE blocks:
   - Non-Agents (line ~658-664): chain role, site, and status filters after the existing search filter
   - Agents (line ~823-837): chain site and status filters after the existing search filter

5. **Reset filters when switching tabs** — clear filter state on tab change via `onValueChange` on the `Tabs` component

### UI Layout
Filters will appear as compact Select dropdowns inline next to the existing search input, maintaining the current toolbar style.

