# BUG-004 — Forced "Choose a new password" dialog on every signed-in page

## Root cause
The forced dialog renders only inside `DashboardLayout.tsx`. The researcher pages
(`ResearchLayout`) and `/wallboard` don't use that layout, so a user whose password
was admin-reset lands on `/research/dashboard` or `/wallboard` and is never forced
to change it. Fix: render it once in `ProtectedRoute.tsx` (which every protected
route already passes through) and remove it from `DashboardLayout` so it can never
double-render.

Confirmed routing: `/research/dashboard`, `/research/campaigns`, `/research/log-call`,
`/research/history` (App.tsx 311–337) and `/wallboard` (App.tsx 146–152) are all
wrapped in `<ProtectedRoute>`. Moving the dialog there covers all of them.

Only two files change. No DB, migrations, edge functions, routes, deps, or other
source files touched.

---

## File 1 — `src/components/ProtectedRoute.tsx`

Add the dialog render in the final success branch only. Loading / no-user /
wrong-role branches stay byte-identical.

Diff:

```diff
 import { Navigate } from 'react-router-dom';
 import { useAuth } from '@/contexts/AuthContext';
+import { ChangePasswordDialog } from '@/components/account/ChangePasswordDialog';
 import { UserRole } from '@/types';

 interface ProtectedRouteProps {
   children: React.ReactNode;
   allowedRoles?: UserRole[];
 }

 export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
-  const { user, isLoading } = useAuth();
+  const { user, isLoading, mustChangePassword, isImpersonating } = useAuth();

   if (isLoading) {
     return (
       ...unchanged loading branch...
     );
   }

   if (!user) {
     return <Navigate to="/login" replace />;
   }

   if (allowedRoles && !allowedRoles.includes(user.role)) {
     ...unchanged redirect branches...
   }

-  return <>{children}</>;
+  return (
+    <>
+      {children}
+      {mustChangePassword && !isImpersonating && <ChangePasswordDialog open forced />}
+    </>
+  );
 }
```

The dialog is appended after `{children}` so page content still renders beneath it;
it appears only when `mustChangePassword` is true and the user is not a
super_admin mid-impersonation. The three early-return branches are untouched, so
unauthenticated and wrong-role users still redirect exactly as today.

---

## File 2 — `src/components/layout/DashboardLayout.tsx`

Remove the dialog, its import, and the now-unused `mustChangePassword` /
`isImpersonating` from the destructure (nothing else in the file uses them —
verified: only occurrences are line 11 import, line 22 destructure, line 71 render).

Diff:

```diff
 import { useSidebar } from '@/contexts/SidebarContext';
 import { useAuth } from '@/contexts/AuthContext';
 import { useAdminNotifications } from '@/hooks/useAdminNotifications';
 import { useCostAlertMonitor } from '@/hooks/useCostAlertMonitor';
 import { cn } from '@/lib/utils';
-import { ChangePasswordDialog } from '@/components/account/ChangePasswordDialog';

 interface DashboardLayoutProps {
   children: ReactNode;
   title: string;
   subtitle?: string;
   actions?: ReactNode;
 }

 export function DashboardLayout({ children, title, subtitle, actions }: DashboardLayoutProps) {
   const { collapsed } = useSidebar();
-  const { hasRole, mustChangePassword, isImpersonating } = useAuth();
+  const { hasRole } = useAuth();
   ...
   return (
     <div ...>
       ...
       <main className="p-6">
         {children}
       </main>
-      {mustChangePassword && !isImpersonating && <ChangePasswordDialog open forced />}
     </div>
   );
 }
```

`hasRole` stays (still used by `isSuperAdmin`). Everything else in the file — the
cost-alert banner, `ImpersonationBar`, `Header`, structure — is unchanged.

---

## What does NOT change
- `ChangePasswordDialog.tsx`, `AuthContext.tsx`, `AppSidebar.tsx` (non-forced
  "Change password" menu item), `ResearchLayout.tsx`, `Wallboard.tsx`, `App.tsx`,
  routes, role redirects, edge functions, migrations, deps.
- Not touching `Leaderboard.tsx`, `SiteFilter.tsx`, `useAgentGoals.ts`.

## Acceptance mapping
- `mustChangePassword=true`, not impersonating → dialog renders exactly once on
  `/dashboard` (DashboardLayout page), on `/research/dashboard`, and on
  `/wallboard`, since all are wrapped by the single `ProtectedRoute` instance
  for that route. It cannot be closed except via Sign out / a successful change.
- `mustChangePassword=false`, or super_admin impersonating → the conditional is
  false, nothing renders. No double-render on DashboardLayout pages.
- Unauthenticated/wrong-role users hit the early returns before the success
  branch, so the dialog is never rendered there.

## Verification
- `tsgo --noEmit -p tsconfig.app.json` → clean.
