

# Allow Supervisors to View Research Insights & Reports

## Current State
- **Routes**: Research routes (dashboard, campaigns, log-call, history) already allow `supervisor` access
- **Sidebar**: Research Insights nav item is restricted to `super_admin` and `admin` only
- **Route guard**: `/research/insights` is restricted to `super_admin` and `admin` only
- **RLS**: `research_insights` table SELECT is restricted to `super_admin` and `admin`
- **Reports page**: Already accessible to supervisors and includes a Research tab

## Changes Required

### 1. Sidebar — Add supervisor to Research Insights nav item
**File**: `src/components/layout/AppSidebar.tsx` (line 83)
- Change `roles: ['super_admin', 'admin']` to `roles: ['super_admin', 'admin', 'supervisor']` for the Research Insights item

### 2. Route guard — Allow supervisor on insights page
**File**: `src/App.tsx` (line 351)
- Change `allowedRoles={['super_admin', 'admin']}` to `allowedRoles={['super_admin', 'admin', 'supervisor']}` for `/research/insights`

### 3. Database — Add supervisor SELECT on research_insights table
- Add a new RLS policy: "Supervisors can view research insights" allowing SELECT for users with `supervisor` role

This gives supervisors read-only access to research insights and reports alongside admins, without granting them management (create/delete) permissions.

