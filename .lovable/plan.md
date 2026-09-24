# BUG-001b — super_admin sets a new password from the User Management edit dialogs

## Files
1. NEW `supabase/functions/admin-reset-password/index.ts`
2. `supabase/config.toml` — append `[functions.admin-reset-password]` / `verify_jwt = true` only
3. NEW `src/components/user-management/ResetPasswordSection.tsx`
4. NEW `supabase/migrations/20260924171500_capture_bug001_access_logs_password_reset.sql` — exact supplied content, written only, never run
5. `src/pages/UserManagement.tsx` — import + three render sites
6. `roadmap.md` — one Done line

No other file changes. No change to `_shared/auth.ts`, no other function, no RLS, no migration executed, no new dependency.

## Function handler flow (admin-reset-password)
Imports from `../_shared/auth.ts`: `requireUser`, `adminClient`, `jsonResponse`, `corsHeaders`.

1. `OPTIONS` → `new Response('ok', { headers: corsHeaders })` (200).
2. Method not `POST` → 405 `{ error: 'Method not allowed' }`.
3. `const auth = await requireUser(req, ['super_admin']); if (!auth.ok) return auth.response;` (no header → 401; other role / inactive / no role → 403).
4. `await req.json()` in try/catch → 400 `{ error: 'Invalid JSON body' }`; non-object body treated the same.
5. `userId` string matching the UUID regex, else 400 `{ error: 'Invalid userId' }`.
6. `userId === auth.ctx.userId` → 400 `{ error: 'You cannot reset your own password here' }`.
7. `newPassword` must be a string; run the copied rule set: length 8–128, `/[A-Z]/`, `/[a-z]/`, `/\d/`, the special-char regex from passwordValidation.ts, not in the copied `COMMON_PASSWORDS` (case-insensitive). Any unmet → 400 `{ error: 'Password does not meet requirements', unmet: [labels] }` (labels same wording as the frontend, plus "At most 128 characters").
8. `adminClient().from('user_roles').select('role').eq('user_id', userId).limit(1)`; error → 500 generic; empty → 404 `{ error: 'User not found' }`.
9. Load names (adminClient, `profiles` `name,email` for caller and target, `maybeSingle`); failure only degrades the audit text.
10. `adminClient().auth.admin.updateUserById(userId, { password: newPassword })`; error → `console.error('[admin-reset-password] update failed:', error.message)` and 500 `{ error: 'Failed to update password' }`.
11. Insert `access_logs` `{ user_id: caller id, user_name: caller name ?? caller email, action: 'password_reset', resource: 'Password reset for <target name ?? email ?? "unknown"> (<userId>)' }` — in try/catch; on error `console.error` with the message only, request still succeeds.
12. 200 `{ success: true }`.

Never logs or returns the password, tokens, or the request body. One unexpected-error catch around the whole flow → 500 generic.

## ResetPasswordSection
- Props `{ userId: string; userName: string }`. Local state: `expanded`, `pw`, `confirm`, `show`, `submitting`.
- Collapsed: outline Button with `KeyRound` icon, "Reset password" (`type="button"`).
- Expanded: "New password" / "Confirm password" Inputs (type toggles via an Eye/EyeOff ghost button), `<PasswordStrengthIndicator result={validatePassword(pw)} show={pw.length > 0} />`, a small "Passwords do not match" hint when confirm is non-empty and differs, buttons "Set password" and "Cancel".
- "Set password" disabled unless `validatePassword(pw).isValid && pw === confirm && pw.length <= 128 && !submitting`.
- Submit: `supabase.functions.invoke('admin-reset-password', { body: { userId, newPassword: pw } })`. On error: if `error instanceof FunctionsHttpError`, `await error.context.json()` → use its `error` (and append `unmet` list if present); else generic message; destructive toast. On success: toast "Password updated for <userName>. Share it with the user securely.", clear fields, collapse.
- Cancel: clear + collapse. Fully separate from "Save Changes".

## UserManagement.tsx render sites (only when `isSuperAdmin`)
Wrapper: `<div className="border-t pt-4 space-y-2"><h4 className="text-sm font-medium">Password</h4><ResetPasswordSection .../></div>`, placed directly above `<DialogFooter>` in:
- Edit Agent dialog (footer ~line 1571): `userId = agents.find(a => a.id === editingAgent.id)?.userId`; rendered only if truthy.
- Edit Researcher dialog (footer ~line 1631): `editingResearcher.id`, `editingResearcher.name`, guarded by `editingResearcher &&`.
- Edit User dialog (footer ~line 1699): `editingUser.id`, `editingUser.name`, guarded by `editingUser &&`.
Plus one import line. Save handlers, Change Role, Deactivate, Delete User and the Edit User gating are untouched.

## Verification
- `tsgo --noEmit -p tsconfig.app.json` clean; `deno check` the new function; deploy only admin-reset-password.
- Unsigned POST `{}` → 401. The 403 / 400-own-id / 200 + access_logs checks need real sessions and a real password change, so they are left for you to run.
- Browser check as super_admin: the section appears in all three dialogs, and Set password stays disabled for weak or mismatched input (no submit).

## Note
The frontend `passwordValidation.ts` has no 128-character maximum. The section adds that limit to its enable check, and that file stays unchanged.
