# BUG-001: Add a working "Edit User" dialog to the Non-Agents tab

One file only: `src/pages/UserManagement.tsx`. No database/RLS/edge-function changes, no new dependency, no publish.

## Current state (confirmed by reading the file)

- The Non-Agents tab renders users whose role is `super_admin`, `admin` or `supervisor` (line 747).
- The row menu's "Edit User" item at line 917 is `<DropdownMenuItem>Edit User</DropdownMenuItem>` — no icon, no onClick, and no backing dialog. Clicking it does nothing.
- The existing **Edit Researcher** flow is the pattern to mirror: state vars (lines 83-84), `handleEditResearcher` open handler (lines 419-429), `handleSaveResearcher` save handler (lines 431-472), and the `<Dialog>` JSX (lines 1513-1570).
- `sites` (local `Site[]`, lines 70 / 270-278) is already populated and already used by the Non-Agents tab's site filter Select (lines 796-800) — reuse it for the supervisor Site field.
- `isSuperAdmin` (line 118) is already derived.

## Changes

### 1. New state variables (insert near line 84, next to the researcher state)

```ts
// Edit non-agent user state
const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
const [editingUser, setEditingUser] = useState<{
  id: string;
  name: string;
  email: string;
  role: string;
  siteId: string;
} | null>(null);
const [isSavingUser, setIsSavingUser] = useState(false);
```

### 2. Open handler (insert after `handleEditResearcher`'s save handler, ~line 472)

```ts
const handleOpenEditUserDialog = (user: UserWithRole) => {
  setEditingUser({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    siteId: user.site_id || '',
  });
  setIsEditUserDialogOpen(true);
};
```

### 3. Save handler (insert immediately after the open handler)

```ts
const handleSaveUser = async () => {
  if (!editingUser) return;
  const trimmedName = editingUser.name.trim();
  if (!trimmedName) return; // save button is disabled for empty names

  setIsSavingUser(true);
  try {
    const updates: { name: string; site_id?: string | null } = { name: trimmedName };
    if (editingUser.role === 'supervisor') {
      updates.site_id = editingUser.siteId || null;
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', editingUser.id)
      .select('id');

    // RLS denials surface as an error OR as an empty returned array (0 rows updated)
    if (error || !data || data.length === 0) {
      toast({
        title: 'Error',
        description: "You don't have permission to edit this user",
        variant: 'destructive',
      });
      return; // keep dialog open
    }

    toast({ title: 'Success', description: 'User updated' });
    setIsEditUserDialogOpen(false);
    setEditingUser(null);
    fetchUsers();
  } catch (error) {
    toast({
      title: 'Error',
      description: "You don't have permission to edit this user",
      variant: 'destructive',
    });
  } finally {
    setIsSavingUser(false);
  }
};
```

Notes:
- Only `name` and (supervisors only) `site_id` are written — no other profile columns.
- `select('id')` is appended so a 0-row RLS denial is detectable as an empty array.
- On denial the toast is destructive and the dialog stays open (no close, no `fetchUsers`).

### 4. Wire + gate the menu item (replace line 917)

Replace:
```tsx
<DropdownMenuItem>Edit User</DropdownMenuItem>
```
with:
```tsx
{isSuperAdmin && (
  <DropdownMenuItem onClick={() => handleOpenEditUserDialog(user)}>
    <Pencil className="w-4 h-4 mr-2" />
    Edit User
  </DropdownMenuItem>
)}
```

- Visible to `super_admin` only (DB only lets super_admin update another profile; admins would get a silent no-op).
- Adds the `Pencil` icon to match the sibling items ("Change Role", "Delete User").
- No other menu items change.

### 5. Edit User dialog JSX (insert after the Edit Researcher Dialog, ~line 1570, before the Delete dialog)

```tsx
{/* Edit User Dialog */}
<Dialog open={isEditUserDialogOpen} onOpenChange={setIsEditUserDialogOpen}>
  <DialogContent className="sm:max-w-[425px]">
    <DialogHeader>
      <DialogTitle>Edit User</DialogTitle>
      <DialogDescription>
        Update user details.
      </DialogDescription>
    </DialogHeader>
    {editingUser && (
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="editUserName">Name *</Label>
          <Input
            id="editUserName"
            value={editingUser.name}
            onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
            placeholder="Enter full name"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="editUserEmail">Email</Label>
          <Input
            id="editUserEmail"
            value={editingUser.email}
            readOnly
            disabled
            className="bg-muted/50 text-muted-foreground"
          />
          <p className="text-xs text-muted-foreground">
            The login email is managed in auth and cannot be changed here.
          </p>
        </div>
        <div className="grid gap-2">
          <Label>Site</Label>
          {editingUser.role === 'supervisor' ? (
            <Select
              value={editingUser.siteId}
              onValueChange={(value) => setEditingUser({ ...editingUser, siteId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a site" />
              </SelectTrigger>
              <SelectContent>
                {sites.map(site => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-primary font-medium">All Sites</p>
          )}
        </div>
      </div>
    )}
    <DialogFooter>
      <Button variant="outline" onClick={() => setIsEditUserDialogOpen(false)} disabled={isSavingUser}>
        Cancel
      </Button>
      <Button onClick={handleSaveUser} disabled={isSavingUser || !editingUser?.name.trim()}>
        {isSavingUser && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Save Changes
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- Email is read-only (rendered in a disabled Input), not editable.
- Site Select appears only for supervisors; super_admin/admin see "All Sites".
- Save button disabled when the trimmed name is empty, and while saving.

## Summary of edits

| Location | Change |
|---|---|
| ~line 84 (after researcher state) | Add `isEditUserDialogOpen`, `editingUser`, `isSavingUser` state |
| ~line 472 (after `handleSaveResearcher`) | Add `handleOpenEditUserDialog` + `handleSaveUser` |
| Line 917 | Replace bare `<DropdownMenuItem>Edit User</DropdownMenuItem>` with a gated, wired item (super_admin only, Pencil icon, onClick) |
| ~line 1570 (after Edit Researcher Dialog) | Add Edit User `<Dialog>` |

## Out of scope (unchanged)

- No DB migration / RLS / policy / edge function / config.toml changes; no new dependency.
- Deactivate, Change Role, Delete User, the Agents tab, Edit Agent, Edit Researcher, CommunicationPermissionsCell, and every other file are untouched.
- No profile columns other than `name` and (supervisors) `site_id` are written by this dialog.

## Other files

None. Only `src/pages/UserManagement.tsx`.

## Verification after approval

- Run `tsgo --noEmit -p tsconfig.app.json` — must be clean.
- No runtime check in plan mode. On build: as super_admin, Non-Agents → ⋮ → Edit User opens a prefilled dialog; name/email/site display; saving updates the row and refreshes the table; cancelling changes nothing; empty name disables Save; as admin the item is not shown; no console errors.
