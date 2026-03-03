

## Fix Researcher Role & Default Vixicom Site Assignment

### Issues Found

1. **Bug**: The `update-user-role` edge function has `validRoles = ['super_admin', 'admin', 'supervisor', 'agent']` — missing `'researcher'`. Any role change to researcher will fail with "Invalid role."
2. **Missing**: When creating or changing a role to researcher, there's no auto-assignment to the Vixicom site. The frontend currently clears the site when researcher is selected.

### Changes

**1. Edge Function (`supabase/functions/update-user-role/index.ts`)**
- Line 106: Add `'researcher'` to `validRoles` array.
- After site validation: when `newRole === 'researcher'`, look up the Vixicom site (`name ILIKE '%vixicom%'`) and auto-assign it as the `siteId` for the profile update.

**2. Frontend (`src/pages/UserManagement.tsx`)**

- **Create User flow** (line 275-280): When researcher is selected, instead of setting site to `'none'`, auto-select the Vixicom site from the `sites` array.
- **Edit Role dialog** (line 1282-1284): Same — when researcher is selected, auto-set `editRoleSiteId` to the Vixicom site.
- **handleUpdateRole** (line 498): Send the `siteId` for researcher role too (not just supervisor/agent).
- **handleCreateUser** (line 328): Send the Vixicom site ID for researcher role.

**3. Edge Function site handling**
- When `newRole === 'researcher'` and no `siteId` is provided, query `sites` for Vixicom and use that ID for the profile update. This ensures backend safety even if frontend doesn't send it.

