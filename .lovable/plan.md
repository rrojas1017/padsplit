

## Fix: Allow Researchers to Toggle Active/Inactive

### Problem
The active/inactive toggle in the Agents tab only works for users who have a linked `agents` table record. Researchers don't have linked agent records, so they show a static status badge instead of a toggle.

### Solution
For researcher users without a linked agent, add a Switch that toggles the `status` field on the `profiles` table directly (between `'active'` and `'inactive'`).

### Changes

**File: `src/pages/UserManagement.tsx`**

1. **Add a `handleToggleUserStatus` function** that updates the `profiles` table `status` field for a given user ID, toggling between `'active'` and `'inactive'`. Refresh the users list after update.

2. **Update the Status column rendering** (around line 1023-1046): Change the `else` branch (when no `linkedAgent`) to show a `Switch` component for researchers, using `user.status === 'active'` as the checked value and calling `handleToggleUserStatus` on change. Keep the static badge for any other edge case.

