

# Add Researcher Role to User Management

## Overview
Enable admins to create researcher accounts from the User Management page by adding the `researcher` role to the existing user creation flow. Researchers will appear in the **Non-Agents tab** since they are standard user accounts (not booking agents).

## Changes Required

### 1. Edge Function: `create-user/index.ts`
- Add `'researcher'` to the `VALID_ROLES` array so the backend accepts it
- No other backend changes needed -- researcher creation follows the same flow as admin (no site required, no agent linking)

### 2. User Management Page: `UserManagement.tsx`
- **Role labels**: Add `researcher: 'Researcher'` to the `roleLabels` map
- **Available roles**: Add `'researcher'` to the role options for super_admin and admin users
- **Role icon**: Add a distinct icon for researcher (e.g., `Mic` or a research-related icon)
- **Role color**: Add a color scheme for the researcher badge (e.g., purple/indigo)
- **Non-Agents filter**: Update the filter from `['super_admin', 'admin', 'supervisor']` to also include `'researcher'`
- **Site field behavior**: When `researcher` is selected, hide the site selector (same as admin/super_admin behavior) since researchers don't need site assignment
- **Subtitle text**: Update "administrators & supervisors" count label to include researchers

### 3. No Database Changes
The `user_roles` table already accepts any text value for the role column, and `researcher` is already defined in the TypeScript `UserRole` type.

## User Experience
1. Admin clicks "Add User" on the Non-Agents tab
2. Fills in name, email, password
3. Selects "Researcher" from the role dropdown
4. Site field is hidden (not applicable)
5. Submits -- researcher account is created
6. New researcher appears in the Non-Agents table with a researcher badge
7. Researcher can now log in and access the research module

