# P6-C — Two small role-regression frontend fixes

Frontend only. No migrations, no SQL, no edge functions, no RLS/config changes. Do not publish. Keep every existing role check. Behaviour for super_admin and admin is unchanged except where noted.

## BUG 1 — 406 on every My Performance load

**File:** `src/hooks/useAgentGoals.ts` (function `useMyGoal`)

The two lookups use `.single()`. When no row exists (every agent without a goal this week, or a super_admin with no agent row) PostgREST returns HTTP 406 and the browser logs a failed request. The existing `if (!agentData)` (line 266) and `if (!goalData)` (line 280) branches already handle "no row", so the UI stays the same.

**Change — two one-line edits, nothing else in the file:**

- Line 264: `.single();` → `.maybeSingle();`  (agents lookup by `user_id`)
- Line 278: `.single();` → `.maybeSingle();`  (agent_goals lookup for the current week)

No other change to the file.

## BUG 2 — Site filter

### 2a/2b — `src/components/dashboard/SiteFilter.tsx`

Today the component imports only `useAgents`, holds local `selected` state, and always renders "All Sites" plus every site. Used by both `Dashboard.tsx` (with `onSiteChange={setSelectedSiteId}`) and `Leaderboard.tsx` (no `onSiteChange`).

**New behaviour:**

- Add `import { useAuth } from '@/contexts/AuthContext';` and read `const { user } = useAuth();`.
- Compute `const isSupervisor = user?.role === 'supervisor' && !!user?.siteId;` and `const supervisorSite = user?.siteId;`.
- Initialize `selected` to `supervisorSite` when `isSupervisor`, else `null` (today's value).
- Add a mount-only `useEffect` that, when `isSupervisor` and `supervisorSite` is set, calls `onSiteChange?.(supervisorSite)` exactly once (empty dependency array, so the Dashboard filters to the supervisor's site on load). This mirrors the `CoachingEngagement.tsx` lock pattern at lines 76–80.
- `handleSelect` returns early (no-op) when `isSupervisor` — the value is locked.
- Render:
  - **Supervisor:** the trigger `Button` is `disabled` and shows only their own site name (`sites.find(s => s.id === supervisorSite)?.name ?? 'My Site'`). The dropdown content contains only that one item (no "All Sites", no other sites). Because the trigger is disabled the menu cannot open.
  - **Every other role (super_admin, admin, agent, researcher, or supervisor without a siteId):** unchanged — "All Sites" + each site, exactly today's UI.
- `selectedLabel` resolves the supervisor's site name even when the `sites` list hasn't loaded yet (falls back to `'My Site'`).

**Changed lines:** the whole component body (lines 1–57). The props interface and exports are unchanged.

### 2c — `src/pages/Leaderboard.tsx`

Today it renders `<SiteFilter />` with no `onSiteChange`, so choosing a site changes nothing.

**Wire it:**

- Replace the bare `<SiteFilter />` (line 53) with `<SiteFilter onSiteChange={setSelectedSiteId} />`.
- Add state via the already-imported `useSessionState`:
  `const [selectedSiteId, setSelectedSiteId] = useSessionState<string | null>('leaderboard:site', null);`
- After the existing `const { bookings, isLoading: bookingsLoading } = useDashboardData(...)` / `agents` are available, compute site-filtered sets (same shape Dashboard already uses):
  ```ts
  const filteredAgents = selectedSiteId
    ? agents.filter(a => a.siteId === selectedSiteId)
    : agents;

  const filteredBookings = selectedSiteId
    ? bookings.filter(b => filteredAgents.some(a => a.id === b.agentId))
    : bookings;
  ```
- Pass these to the calculators:
  ```ts
  const leaderboard = calculateLeaderboard(filteredBookings, filteredAgents, dateRange, customDates);
  const nonBookingCount = calculateNonBookingCount(filteredBookings, dateRange, customDates);
  ```
  `null` (no site) = all sites, exactly today's numbers. `summaryStats` already derives from `leaderboard`, so it follows automatically.

A supervisor on the Leaderboard is locked to their own site by the 2a change (their SiteFilter preselects and calls `onSiteChange` on mount), so the table now correctly scopes to their site instead of showing every site.

**Changed line ranges in Leaderboard.tsx:** add the `selectedSiteId` state line (after the existing `customDates` session-state line, ~line 19); add the `filteredAgents`/`filteredBookings` block (after the `nonBookingCount` line ~line 29, before `summaryStats`); change the `calculateLeaderboard`/`calculateNonBookingCount` arguments (lines 28–29); change `<SiteFilter />` → `<SiteFilter onSiteChange={setSelectedSiteId} />` (line 53).

## Out of scope / unchanged

- `Dashboard.tsx` already passes `onSiteChange={setSelectedSiteId}` and already filters by site — the only new effect there is that a supervisor is now preselected to their site on load (from 2a). No Dashboard code change.
- No change to role checks anywhere; super_admin/admin behaviour is unchanged except the supervisor lock is supervisor-only.
- No personal data logged.

## Verification after implementation

- `tsgo --noEmit -p tsconfig.app.json` — must be clean.
- Report the exact changed line ranges per file.
- Do not publish.
