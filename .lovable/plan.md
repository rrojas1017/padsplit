

## Add Edit Option for Researchers in Agents Tab

### Problem
Researchers don't have linked records in the `agents` table, so the "Edit Agent" menu item (guarded by `linkedAgent &&`) never renders for them. Admins/super admins cannot edit researcher details.

### Solution
Add an "Edit Researcher" option for users with `role === 'researcher'` who don't have a `linkedAgent`. This will open a dialog to edit their name and site directly on the `profiles` table.

### Changes

**File: `src/pages/UserManagement.tsx`**

1. **Add state for editing researcher**: Add `isEditResearcherDialogOpen` and `editingResearcher` (with `id`, `name`, `siteId`) state variables.

2. **Add `handleEditResearcher` function**: Populates edit state from the user's profile data (`user.id`, `user.name`, `user.siteId`).

3. **Add `handleSaveResearcher` function**: Updates the `profiles` table with new `name` and `site_id`, then refreshes users.

4. **Update dropdown menu** (line 1093): Add an `else` branch for researchers without a `linkedAgent`:
   ```
   {linkedAgent && ( <Edit Agent> )}
   {!linkedAgent && user.role === 'researcher' && (isSuperAdmin || isAdmin) && ( <Edit Researcher> )}
   ```

5. **Add Edit Researcher Dialog**: Simple dialog with Name input and Site dropdown, similar to the existing Edit Agent dialog but updating the `profiles` table instead of the `agents` table.

