

## Two Changes to User Management

### 1. Allow admins to change roles (limited scope)

**Current behavior**: Only `super_admin` can see the "Change Role" menu item, and the edge function enforces `super_admin` only.

**Changes needed**:

**Frontend (`src/pages/UserManagement.tsx`)**:
- Lines 833 and 1048: Change `{isSuperAdmin &&` to `{(isSuperAdmin || isAdmin) &&` to show the "Change Role" option for admins too.
- Line 1265-1271: When the current user is an `admin` (not super_admin), limit the role options in the edit role dialog to only `agent`, `supervisor`, and `researcher` (admins cannot assign `super_admin` or `admin` roles).

**Backend (`supabase/functions/update-user-role/index.ts`)**:
- Line 67: Allow both `super_admin` and `admin` roles to proceed.
- Add validation: if the requesting user is `admin`, they can only assign roles `agent`, `supervisor`, or `researcher` — block attempts to assign `super_admin` or `admin`.
- Block admins from changing the role of another `super_admin` or `admin` user.

### 2. Move researchers to the Agents tab

**Current behavior**: Researchers appear in Non-Agents tab (line 661 filters for `super_admin`, `admin`, `supervisor`, `researcher`). Agents tab only shows `role === 'agent'` (line 872).

**Changes needed** (`src/pages/UserManagement.tsx`):
- Line 661: Remove `'researcher'` from the Non-Agents filter array.
- Line 872: Change from `u.role !== 'agent'` to `!['agent', 'researcher'].includes(u.role)` — include researchers in the Agents tab.
- Line 896: Update the count label from "agents" to "agents & researchers".
- Line 699-703: Remove the "Researcher" option from the Non-Agents role filter dropdown.

