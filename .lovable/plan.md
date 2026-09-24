# BUG-002: Deactivate/Reactivate, reset signs out everywhere, "Change my password"

## What changes for users
- super_admin can Deactivate / Reactivate a login from User Management (both tabs). Deactivated users are signed out everywhere and cannot sign in.
- After an admin password reset, the user is signed out everywhere and must pick a new password at next sign-in (dialog they can't close, only "Sign out").
- Every role gets "Change password" in the sidebar.

## Files
New: `supabase/functions/admin-set-user-status/index.ts`, `supabase/functions/change-own-password/index.ts`, `src/components/account/ChangePasswordDialog.tsx`, `supabase/migrations/20260924190000_capture_bug002_user_status_sessions.sql` (verbatim, written only, never run).
Edited: `supabase/config.toml` (two `verify_jwt = true` blocks only), `supabase/functions/admin-reset-password/index.ts`, `src/contexts/AuthContext.tsx`, `src/components/layout/DashboardLayout.tsx`, `src/components/layout/AppSidebar.tsx`, `src/pages/UserManagement.tsx`, `src/components/user-management/ResetPasswordSection.tsx` (success toast text only), `roadmap.md`.
Not touched: `_shared/auth.ts`, other functions, RLS, dependencies.

## Function flows

### admin-set-user-status
1. OPTIONS → ok; non-POST → 405.
2. `requireUser(req, ['super_admin'])` → 401/403.
3. Parse JSON; `userId` must be a UUID, `active` a boolean → else 400.
4. `userId === caller` → 400 "You cannot change your own status".
5. `user_roles` lookup (admin client); none → 404 "User not found".
6. Read the target's `profiles` (name, email, status) → `prevStatus`.
7. Update `profiles.status` to `'inactive'` / `'active'`; error → 500.
8. `auth.admin.updateUserById(userId, { ban_duration: active ? 'none' : '876000h' })`; on error restore `prevStatus`, → 500.
9. Deactivate only: `rpc('revoke_user_sessions', { p_user_id })` → `n` (on error: log the message only, `n = null`).
10. Insert audit row (try/catch, never fails the request): `user_deactivated` "Deactivated <name/email> (<id>); sessions ended: <n>" or `user_reactivated` "Reactivated <name/email> (<id>)".
11. 200 `{ success: true, status, sessionsRevoked }` (null on reactivate).

### admin-reset-password (only these changes)
- `updateUserById(userId, { password, app_metadata: { must_change_password: true } })`.
- Then `rpc('revoke_user_sessions', { p_user_id: userId })`; error → logged, `sessionsRevoked: null`.
- Audit resource adds "; sessions ended: <n>"; response `{ success: true, sessionsRevoked }`.

### change-own-password
1. OPTIONS / 405 as above.
2. `requireUser(req, ANY_ROLE)` (inactive users rejected there).
3. Body: both must be strings → else 400. Same copied rule set plus "Must differ from current password" → 400 `{ error, unmet }`.
4. New anon client (persistSession false) `signInWithPassword({ email: ctx.user.email, password: currentPassword })`; error → 400 "Current password is incorrect".
5. `updateUserById(userId, { password, app_metadata: { must_change_password: false } })`; error → 500.
6. Read the `session_id` claim by base64url-decoding the payload of the already-verified bearer token; `rpc('revoke_user_sessions', { p_user_id, p_keep_session_id })` (this also ends the verification sign-in session). Error → logged, n = null.
7. Audit `password_change` "Changed own password; other sessions ended: <n>".
8. 200 `{ success: true }`. Passwords and tokens are never logged.

## UI changes
- **ChangePasswordDialog**: as specified (three fields, strength indicator, show/hide, submit gating, reads the JSON error + unmet list on errors, refreshSession on success, forced mode that blocks Escape/outside click, hides the close button, and has a "Sign out" link).
- **AuthContext**:
  - `mustChangePassword` state comes from `session.user.app_metadata.must_change_password === true`. It is set on initial load, SIGNED_IN, TOKEN_REFRESHED and USER_UPDATED, and exposed via a `refreshMustChangePassword()` helper that the dialog calls after refreshSession.
  - In `fetchUserData`: an inactive profile means signOut, clear user/session, show the deactivated toast, return false. The callers (lines ~221 and ~358) skip the `setMinimalUser` fallback in that case, using an `inactiveRef` flag.
  - In `login`: an error containing "banned" returns the deactivated message; so does an inactive profile after sign-in.
  - A 5-minute interval plus the existing visibilitychange handler call `getUser()`. A 401/403 means local signOut and the "Your session has ended" toast. The interval is cleared on unmount and on sign-out.
  - Impersonation is untouched.
- **DashboardLayout**: renders `<ChangePasswordDialog open forced />` when `mustChangePassword && !isImpersonating`.
- **AppSidebar**: a "Change password" item (KeyRound icon, same styling as Logout, label hidden when collapsed) sits just above Logout (~line 336). It is hidden while impersonating.
- **UserManagement**:
  - Non-Agents menu (line 995): the bare Deactivate becomes a Deactivate (UserX, destructive) / Reactivate (UserCheck) item, shown only when `isSuperAdmin && user.id !== currentUser?.id`.
  - Agents menu (~1238 block): the same condition, labelled "Deactivate login" / "Reactivate login".
  - Unlinked-row Switch (~1191): now opens the same confirmation. It is `disabled={!isSuperAdmin}` and also disabled for your own row. The linked-agent Switch (~1178) stays unchanged.
  - A "Login disabled" badge shows next to the name on both tabs when `status === 'inactive'`.
  - New state `statusTarget {user, active}` plus a confirmation Dialog with the specified texts. Confirm invokes `admin-set-user-status`, shows a toast (including the sessions-ended count on deactivate), then runs `fetchUsers()`. Errors come from the function's JSON reply.
  - `handleToggleUserStatus` (line 664) is deleted if nothing else uses it after the change.
- **ResetPasswordSection**: the success toast now reads: "Password updated for <userName>. They were signed out everywhere and must choose a new password at next sign-in."

## Verification
- `tsgo` clean.
- `deno check` on all 3 functions.
- Deploy only those 3.
- Unsigned POST {} → 401 each.
- Browser check as super_admin: menu items and confirmation dialog render, without confirming a real deactivation.
- The role-based 403/400 and real deactivate/reset flows are left for you to run.
- Nothing published.
