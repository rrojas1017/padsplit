# CR-011 — Hide the Agent Status module

The `/agent-status` page is removed from the sidebar and its route becomes a redirect to `/dashboard`. The page file, the status context, the heartbeat, and `agent_sessions` writes are all left intact. Research agents work in ViciDial and never sign in here, so the page shows everyone Offline; hiding it stops that misleading view.

## Current state (verified)

**Visible link to `/agent-status` (the only one):**
- `src/components/layout/AppSidebar.tsx:92` — `item('sales', Activity, 'Agent Status', '/agent-status', ['super_admin', 'admin', 'supervisor'])` in the `sales` group.

**`Activity` icon usage:** imported at `AppSidebar.tsx:2` and used only on line 92. Nothing else in the file imports or uses `Activity`, so the import is removed too.

**Route and page import in `src/App.tsx`:**
- `App.tsx:34` — `import AgentStatus from "./pages/AgentStatus";`
- `App.tsx:202-208` — the `/agent-status` route, wrapped in `ProtectedRoute allowedRoles={['super_admin', 'admin', 'supervisor']}` → `DataProviders` → `<AgentStatus />`.
- `Navigate` is already imported (`App.tsx:6`), used for the `/member-insights` redirect at line 211.

**AgentStatusProvider:** `App.tsx:13` import and `App.tsx:72-74` wrap inside `DataProviders`. `useAgentStatus` is consumed **only** by `src/pages/AgentStatus.tsx` (and defined in the context). Per the must-not-change list, the provider and context are left as-is — they become unused by any rendered page but stay intact and harmless.

**`view_agent_status` page-tracking:** `usePageTracking('view_agent_status')` lives **only** at `src/pages/AgentStatus.tsx:28`. There is no shared page-tracking map keyed by route; `src/hooks/usePageTracking.ts` takes the action string as a direct argument. So nothing else needs changing for tracking.

**Other matches found (non-visible, left alone):**
- `src/pages/AuditLog.tsx:54` — `view_agent_status` is an entry in `ACTION_CONFIG`, a display-only map that renders an icon + label for **existing** `access_logs` rows whose `action = 'view_agent_status'`. It is not a page-view trigger. Leaving it means historical audit rows still render correctly. No change.
- `src/contexts/AgentsContext.tsx` / `src/pages/UserManagement.tsx` / `src/pages/ImportBookings.tsx` — these reference `toggleAgentStatus` / `getAgentStatus` (agent active/inactive and import-match helpers), unrelated to the Agent Status page. No change.
- `src/components/security/LoginHistoryPanel.tsx`, `src/pages/DisplayLinks.tsx`, `src/pages/Billing.tsx`, `src/components/billing/RealtimeCostDashboard.tsx`, `src/components/import/BulkProcessingTab.tsx` — matched only via the broad `agent_status`/`AgentStatus` substring in the earlier file listing; targeted searches for `agent-status` / `AgentStatus` found no actual references. No change.

**No matches** in: dashboard cards (`Dashboard.tsx`, `Wallboard.tsx`), command palette (`src/components/ui/command.tsx` is the generic primitive with no configured items), markdown, or tests.

## Build

### 1. `src/components/layout/AppSidebar.tsx`
- Delete line 92 (the `Agent Status` item in the `sales` group).
- Remove `Activity,` from the `lucide-react` import block (line 2), since it is now unused. All other imports and the rest of the `sales` group are unchanged.

### 2. `src/App.tsx`
- Remove line 34: `import AgentStatus from "./pages/AgentStatus";`
- Replace the route body at lines 202-208 so the path redirects to `/dashboard`, keeping the existing `ProtectedRoute` wrapper and `allowedRoles` exactly as they are:
  ```tsx
  <Route path="/agent-status" element={
    <ProtectedRoute allowedRoles={['super_admin', 'admin', 'supervisor']}>
      <Navigate to="/dashboard" replace />
    </ProtectedRoute>
  } />
  ```
  `DataProviders` is dropped from this route (a redirect needs no data contexts), and `Navigate` is already imported. The `AgentStatusProvider` import and its placement inside `DataProviders` (lines 13, 72-74) stay unchanged.

### 3. `src/pages/AgentStatus.tsx`
- Not deleted, not edited. It becomes unreachable (no route renders it and no import remains). Easy to restore later.

### 4. Audit log display mapping
- `src/pages/AuditLog.tsx:54` (`view_agent_status` in `ACTION_CONFIG`) is left as-is. It only styles pre-existing `access_logs` rows; removing it would make any historical "Agent Status" view rows render with a generic fallback. The `access_logs` CHECK constraint is not touched.

## Files touched

Edited:
- `src/components/layout/AppSidebar.tsx` (remove nav item + `Activity` import)
- `src/App.tsx` (remove page import; route → `Navigate` redirect, same `ProtectedRoute` + roles)

Not touched:
- `src/pages/AgentStatus.tsx` (kept, unreachable)
- `src/contexts/AgentStatusContext.tsx`, `App.tsx`'s `AgentStatusProvider`, `agent_sessions` writes, the heartbeat, the Settings → Security login-history panel, `useSidebarOrder`, `sidebar_custom_order*` preference data
- `src/pages/AuditLog.tsx` (display mapping kept; CHECK constraint unchanged)
- Every other route, role gate, the database
- No new dependencies

## Verification
- `tsgo --noEmit -p tsconfig.app.json` is clean.
- No role sees the Agent Status item in the sidebar.
- Visiting `/agent-status` as super_admin/admin/supervisor lands on `/dashboard` with no console error.
- Other roles hitting `/agent-status` keep today's `ProtectedRoute` behaviour (redirect-after-auth-gate).
- Nothing published.
