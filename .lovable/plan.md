# CR-003 — Admins manage staff logins; admins cannot delete other admins

Verified current state:
- `admin-set-user-status` and `admin-reset-password` both call `requireUser(req, ["super_admin"])` and look up the target role with `.select("role").eq("user_id", userId).limit(1)` (404 on no rows, 500 on error). First writes: profile status update (status) / `updateUserById` password (reset).
- `delete-user` uses `requireUser(req, ADMINS)`, target role lookup with `.single()`, and the existing super_admin target guard. Only write is `deleteUser`.
- UserManagement.tsx: Deactivate/Reactivate items at lines 1056 and 1322 are `isSuperAdmin && user.id !== currentUser?.id`; Agents-tab status Switch line 1269 `disabled={!isSuperAdmin || user.id === currentUser?.id}`; ResetPasswordSection wrappers at 1663 (agent), 1733 (researcher), 1807 (user) are `isSuperAdmin && ...`; Change Role items 1050/1316 are `(isSuperAdmin || isAdmin) && user.id !== currentUser?.id`; Delete User items follow at 1078/1344.

## 1. supabase/functions/admin-set-user-status/index.ts
- Line 10: `requireUser(req, ["super_admin", "admin"])`.
- Line 23: drop `.limit(1)` — fetch all role rows. Error → 500 as today; no rows → 404 as today.
- New guard immediately after the 404 check and BEFORE the first write (the profiles status update at line 34): if `auth.ctx.role === "admin"` and any returned role is `super_admin` or `admin` → 403 `{ error: "Admins can only manage supervisor, agent and researcher users" }`.
- Everything else byte-identical: body validation, own-id 400, ban/unban + rollback, `revoke_user_sessions`, audit actions `user_deactivated`/`user_reactivated`, response shape.

## 2. supabase/functions/admin-reset-password/index.ts
- Line 31: `requireUser(req, ["super_admin", "admin"])`.
- Line 49: drop `.limit(1)`. Error → 500; no rows → 404 (as today).
- New guard after the 404 check and BEFORE the first write (`updateUserById` at line 58): admin caller + any target role `super_admin`/`admin` → 403 with the same message.
- Everything else unchanged: password rules, own-id 400, `must_change_password` flag, session revoke, audit `password_reset`, response shape.

## 3. supabase/functions/delete-user/index.ts
- Lines 66–70: replace `.single()` with all role rows (`select('role').eq('user_id', userId)`); lookup error → 500 `{ error: 'Failed to delete user' }`.
- Keep the super_admin target guard, now checking ANY returned role === 'super_admin' with non-super_admin caller → 403 'Only super_admin can delete super_admin users'.
- New: caller role `admin` and any target role `admin` → 403 'Admins cannot delete other admins'.
- Both guards sit before the only write (`deleteUser`). Auth, self-delete 400, UUID check, responses unchanged.

## 4. src/pages/UserManagement.tsx
Add near the role helpers:
```ts
const STAFF_TARGET_ROLES = ['supervisor', 'agent', 'researcher'];
const canManageLogin = (role: string) => isSuperAdmin || (isAdmin && STAFF_TARGET_ROLES.includes(role));
```
- Deactivate/Reactivate menu items (lines 1056, 1322): `canManageLogin(user.role) && user.id !== currentUser?.id`.
- Agents-tab login status Switch (line 1269): `disabled={!canManageLogin(user.role) || user.id === currentUser?.id}`.
- ResetPasswordSection wrappers:
  - Edit User dialog (1807): `canManageLogin(editingUser.role) && editingUser`.
  - Edit Researcher dialog (1733): `canManageLogin('researcher') && editingResearcher`.
  - Edit Agent dialog (1663): `(isSuperAdmin || isAdmin) && editingAgent` plus existing linkedUserId check.
- Change Role items (1050, 1316): append `&& (isSuperAdmin || STAFF_TARGET_ROLES.includes(user.role))`.
- Delete User items (1078, 1344): append `&& (isSuperAdmin || STAFF_TARGET_ROLES.includes(user.role))`.
- Error handling: existing handlers already surface the function's `{error}` body as a destructive toast and skip the success toast — verified, no change needed beyond keeping that path.

## Not changed
Supervisor/agent/researcher screens; super_admin behaviour; dialog fields; CR-001 permission switches and denial checks; ResetPasswordSection; ChangePasswordDialog; routes; audit action names; `_shared/auth.ts`; no migration/RLS/DB change; no new deps; no other files; do not publish.

## Verification after build
- `deno check` on the three functions; unsigned POST `{}` → 401 each; signed admin call against a super_admin target → 403 with the new message (both functions); admin delete of an admin target → 403.
- `tsgo --noEmit -p tsconfig.app.json` clean.
