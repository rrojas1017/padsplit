## Goal

Let a super admin temporarily view the app (specifically Reports) through another user's role + site context, so we can reproduce what **Jack Avera** (`jack@padsplit.com`, role `admin`, no `site_id`) is missing without logging in as him.

Important constraint: Supabase auth session stays the super admin's. RLS still runs as super admin. This is a **UI-level simulation** of the `useAuth()` shape (role, site_id, name) — enough to expose what the frontend hides/filters, which is where most "I can't see X" issues live in this codebase (Reports filters by role/site in code, not just RLS).

## Scope

Only the frontend. No DB schema, no RLS, no edge functions.

### 1. New `ImpersonationContext` (`src/contexts/ImpersonationContext.tsx`)
- Holds `impersonatedUser: { id, name, email, role, site_id } | null`.
- `setImpersonatedUser`, `clearImpersonation`.
- Persists in `sessionStorage` (cleared on tab close, never leaks across sessions).
- Provider mounted in `src/App.tsx` inside `AuthProvider`.

### 2. Patch `useAuth()` (`src/contexts/AuthContext.tsx`)
- When an impersonation is active AND the real user is `super_admin`, override the returned `user` object and `hasRole(...)` to reflect the impersonated user.
- Real `session`, `signOut`, etc. stay untouched.
- Guard: non-super-admins can never trigger impersonation (defense in depth — the picker UI is also gated).

### 3. Impersonation bar (`src/components/layout/ImpersonationBar.tsx`)
- Sticky banner shown at top of `DashboardLayout` whenever impersonation is active.
- Shows: "Viewing as **Jack Avera** (admin) — Exit".
- Rendered above the existing critical-cost banner.

### 4. "View as user" picker
- New item in `Header.tsx` user dropdown (super_admin only): **View as user…**
- Opens a dialog listing users from `profiles` joined with `user_roles` (searchable by name/email).
- Selecting one sets impersonation and navigates to `/reports`.

### 5. Diagnostic dev panel inside Reports (super_admin only, collapsed by default)
- Small "Why is this hidden?" panel at top of `Reports.tsx` that prints the effective `user.role`, `user.site_id`, active filters, and counts of rows excluded by role/site gates. Helps pinpoint Jack's issue immediately and stays useful afterward.

## Out of scope

- Server-side impersonation / RLS bypass. We are not changing `auth.uid()`. Any data Jack can't see due to RLS (not frontend filters) will still not appear; the diagnostic panel will make that distinction explicit ("hidden by RLS vs hidden by UI").
- Reports refactor or filter changes.

## Acceptance

1. Super admin opens user menu → "View as user…" → picks Jack.
2. Banner appears: "Viewing as Jack Avera (admin)".
3. `/reports` re-renders using admin role + Jack's (empty) site_id.
4. Diagnostic panel shows which rows/tabs/columns the UI is hiding for that role/site combo, exposing the root cause.
5. "Exit" restores super admin view immediately.

## Security notes

- Picker + context override are both gated on real `super_admin` role (checked from the real session, not the impersonated one).
- Session-scoped storage, not localStorage.
- No DB writes performed under impersonation context get a fake user_id — `auth.uid()` is unchanged.
