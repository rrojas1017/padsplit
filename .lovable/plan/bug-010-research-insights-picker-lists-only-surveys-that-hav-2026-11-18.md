# BUG-010 — Research Insights picker lists only surveys that have a campaign

One file only: `src/pages/research/ResearchInsights.tsx`. No database, function, hook, type, route or dashboard change. No deploy, no publish.

## What changes for the user
The survey picker at the top of Research Insights shows a survey only when Campaign Manager has at least one campaign for it, whatever that campaign's status (draft, active, paused or completed). After the change, "PadSplit Post Move-In Satisfaction — Early Experience & Issue Detection" disappears from the picker, because it has no campaigns. All other active surveys have 1–2 campaigns today, so they stay. If the campaign check fails, the picker shows exactly what it shows today.

## Steps
1. **Scripts query** (new key `['research-scripts-for-insights', 'v3-with-campaigns']`):
   - Read active scripts (`id, name, slug, campaign_type`, `is_active = true`, ordered by name) without the `.not('campaign_type', …)` exclusion, so the three fixed survey ids come back too.
   - Run `supabase.rpc('get_script_campaigns', { p_script_id: id })` for every active script in parallel with `Promise.allSettled`.
   - `withCampaign` = ids whose call returns 1 or more rows. `lookupOk` = every call fulfilled with no error.
   - The dynamic list is filtered with the existing HIDDEN_SLUGS / HIDDEN_CAMPAIGN_TYPES / HIDDEN_IDS / name rule, copied unchanged. Since the SQL no longer filters, the move-out and audience scripts are also kept out of this list in JS, by campaign_type, exactly as before.
   - Returns `{ scripts, withCampaign, lookupOk }`.
   - It does not read `research_campaigns` directly and does not use `useResearchCampaigns` for this.
2. **Dynamic entries** (`script:<id>`): shown only when the id is in `withCampaign`. Fail open: while loading or when `lookupOk` is false, the list is shown exactly as today.
3. **Fixed entries**, gated by the same rule and failing open in the same way:
   - Move-Out Research → `6397bb7f-ac6a-49ea-90ad-9ca6ec046434`
   - Audience Survey → `12fd2184-68af-4502-9f8e-9fc9fcef1214`
   - Payment Experience Survey → `c701a243-1c66-425a-8f79-99a290ec5b6b`
4. **Saved selection:** a memo lists the visible option values. Once the query has loaded and `lookupOk` is true, if the current `campaignType` (from `?campaign=` or localStorage) is not visible, an effect calls the existing `handleCampaignTypeChange(firstVisible)`. It does nothing while loading, when `lookupOk` is false, or when no option is visible.

## Kept as is
The `useResearchCampaigns` call already on this page and its other uses, all dashboards, the in-dashboard Campaign and List filters, Campaign Manager, Script Builder, and `Leaderboard.tsx` / `SiteFilter.tsx` / `useAgentGoals.ts`.

## Verification
Run `tsgo --noEmit -p tsconfig.app.json` and report the list of changed files (expected: `src/pages/research/ResearchInsights.tsx` only).
