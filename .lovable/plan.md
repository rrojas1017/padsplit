# CR-001 — Admins can edit supervisor, agent and researcher users in User Management

Frontend-only. Two files: `src/pages/UserManagement.tsx` and `src/components/user-management/CommunicationPermissionsCell.tsx`. No database, RLS, migration, edge function, route, query key, audit action name, or other file changes.

The RLS policy + trigger already live in production (admin can UPDATE `profiles` for supervisor/agent/researcher rows, limited to name, site_id, and the four `can_send_*` columns; super_admin and admin rows are 0 rows; status/email changes error 42501). We only wire the UI to use it and to detect denials.

---

## File 1 — `src/components/user-management/CommunicationPermissionsCell.tsx`

**3a. New optional `disabled` prop (default false)**
- Add `disabled?: boolean;` to `CommunicationPermissionsCellProps` (interface, lines 9–18).
- Destructure `disabled = false,` in the component params (lines 20–29).

**Disable only the Switch and the 3 Checkboxes — no new styles/colors/layout**
- `Switch` (lines 39–42): add `disabled={disabled}`.
- Email `Checkbox` (lines 70–74): add `disabled={disabled}`.
- SMS `Checkbox` (lines 79–83): add `disabled={disabled}`.
- Voice `Checkbox` (lines 88–92): add `disabled={disabled}`.
- The `CollapsibleTrigger` Button and labels are left untouched (per the ticket: only the Switch and the 3 Checkboxes).

---

## File 2 — `src/pages/UserManagement.tsx`

### Shared helper (new, local to the component, above the return at ~line 815)

```ts
const canEditComms = (user: UserWithRole) =>
  isSuperAdmin ||
  (isAdmin &&
    (user.id === currentUser?.id ||
      ['supervisor', 'agent', 'researcher'].includes(user.role)));
```

`isSuperAdmin`, `isAdmin`, and `currentUser` already exist (lines 135–137, 77). No new state.

---

### Item 1 — Non-Agents tab "Edit User" menu visibility

Lines 1008–1013 today: `{isSuperAdmin && (`.

Change the guard to:

```tsx
{(isSuperAdmin || (isAdmin && ['supervisor', 'agent', 'researcher'].includes(user.role))) && (
  <DropdownMenuItem onClick={() => handleOpenEditUserDialog(user)}>
    <Pencil className="w-4 h-4 mr-2" />
    Edit User
  </DropdownMenuItem>
)}
```

Exact condition: `isSuperAdmin || (isAdmin && ['supervisor','agent','researcher'].includes(user.role))`.

On the Non-Agents tab the only rows present are super_admin/admin/supervisor (filter at line 835), so for an admin this opens Edit User only on supervisor rows. The Edit User dialog body (lines 1713–1786) is unchanged: Name required + trimmed, Email read-only/disabled, Site select shown only when `editingUser.role === 'supervisor'`, otherwise "All Sites". The "Reset password" section inside the dialog stays `isSuperAdmin &&` (line 1770) — unchanged.

---

### Item 2 — Agents tab "Edit Researcher": detect permission failure in `handleSaveResearcher`

Lines 448–489. Today the profile update at lines 452–459 has no `.select('id')` and throws on error.

Replace:

```ts
const { error: profileError } = await supabase
  .from('profiles')
  .update({
    name: editingResearcher.name,
    site_id: editingResearcher.siteId || null,
  })
  .eq('id', editingResearcher.id);
if (profileError) throw profileError;
```

with:

```ts
const { data: profileData, error: profileError } = await supabase
  .from('profiles')
  .update({
    name: editingResearcher.name,
    site_id: editingResearcher.siteId || null,
  })
  .eq('id', editingResearcher.id)
  .select('id');

// RLS denials surface as an error OR as an empty returned array (0 rows updated)
if (profileError || !profileData || profileData.length === 0) {
  toast({
    title: 'Error',
    description: "You don't have permission to edit this user",
    variant: 'destructive',
  });
  return; // keep dialog open; do NOT update/create the agent record
}
```

On a confirmed 1-row update, fall through to the existing linked-agent update/create block (lines 462–480) and the success toast + close, unchanged. This matches the pattern `handleSaveUser` already uses (lines 514–528).

---

### Item 3 — Communication permissions

#### 3a/3b. Pass `disabled` to both `CommunicationPermissionsCell` instances

Non-Agents tab cell (lines 988–997) and Agents tab cell (lines 1247–1256): add

```tsx
disabled={!canEditComms(user)}
```

So for admins the cell is read-only on super_admin rows and on other admins' rows (unless it's the current admin's own row), and enabled on the current user and on supervisor/agent/researcher rows. For super_admin it is always enabled.

#### 3c. `handleToggleCommunicationPermission` (lines 705–740)

Replace the update + error check (lines 710–715)

```ts
const { error } = await supabase
  .from('profiles')
  .update({ can_send_communications: newValue })
  .eq('id', userId);

if (error) throw error;
```

with

```ts
const { data, error } = await supabase
  .from('profiles')
  .update({ can_send_communications: newValue })
  .eq('id', userId)
  .select('id');

if (error || !data || data.length === 0) {
  toast({
    title: 'Error',
    description: "You don't have permission to change this user's permissions",
    variant: 'destructive',
  });
  return;
}
```

Only after a confirmed 1-row update: keep the existing `access_logs` insert with action `communication_permission_grant` / `communication_permission_revoke` (unchanged names), the existing success toast, and `fetchUsers()`. On denial: no access_logs row, no "Permission Updated" toast, dialog stays consistent with the disabled control.

#### 3c. `handleToggleChannelPermission` (lines 743–785)

Same pattern. Replace (lines 754–759)

```ts
const { error } = await supabase
  .from('profiles')
  .update({ [columnName]: newValue })
  .eq('id', userId);

if (error) throw error;
```

with

```ts
const { data, error } = await supabase
  .from('profiles')
  .update({ [columnName]: newValue })
  .eq('id', userId)
  .select('id');

if (error || !data || data.length === 0) {
  toast({
    title: 'Error',
    description: "You don't have permission to change this user's permissions",
    variant: 'destructive',
  });
  return;
}
```

Keep the existing `access_logs` insert with action `channel_permission_grant` / `channel_permission_revoke` (unchanged names) and success toast on confirmed update only.

---

## What does NOT change (confirmation)

- Deactivate/Reactivate login (menu items + confirmation dialog + `admin-set-user-status`): still `isSuperAdmin`-only.
- The status switch on the Agents tab (`disabled={!isSuperAdmin || user.id === currentUser?.id}`, line 1233): unchanged.
- Password reset / `ResetPasswordSection` in every edit dialog: still `isSuperAdmin`-only (lines 1626, 1696, 1770).
- "Change Role" menu item visibility (lines 1014–1019, 1279–1284): unchanged.
- "Delete User" visibility (lines 1033–1044, 1298–1309): unchanged.
- "Edit Agent" dialog and `handleSaveAgent` (lines 402–434, 1577–1645): unchanged.
- The Edit User dialog body, the Edit Researcher dialog body (except the handler), and the Create User dialog: unchanged.
- Supervisors, agents, and researchers see nothing new — no new menu items, no new enabled controls, no new tabs.
- No route, audit action name, query key, or `user_preferences` key changes.
- No other files touched; no database changes; nothing published.

## Verification (after build approval)

- `tsgo --noEmit -p tsconfig.app.json` is clean.
- No edge functions are changed, so no `deno check`/deploy needed.
- Browser check as an admin on `/users`: Edit User appears on supervisor rows (Non-Agents) and researcher rows without a linked agent (Agents tab); it does not appear on super_admin/other admin rows. Editing a supervisor's name saves; the comms toggles are enabled on self/supervisor/agent/researcher rows and disabled (read-only) on other admins'/super_admins' rows. Attempting a comms toggle on a row the admin can't write (simulated by a row whose role is super_admin, where the cell is disabled) does not fire a request because the control is disabled.
