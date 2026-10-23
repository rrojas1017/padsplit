# CR-014 — Campaign filter on per-script survey insights

Frontend only. No functions, migrations, RLS, data, dependencies or publish.

## Findings (checked)
- Foreign keys exist: `bookings.research_call_id → research_calls.id` and `research_calls.campaign_id → research_campaigns.id`, so the campaign is read through a nested embed (no id-chunk lookup needed).
- Access: `research_calls` is readable by super_admin/admin (and researchers, their own calls only). `research_campaigns` is readable by super_admin/admin (and researchers, assigned campaigns only). Supervisors can read neither. The filter will therefore only show for admins; supervisors see today's view.
- The Submissions tab (`ScriptSubmissionsTab`) runs its own queries on `research_campaigns`/`research_calls`, not the shared hook, so the filter does **not** apply to it (out of scope under rule 3, "if it lists records from the same hook").

## Changes
1. `src/hooks/useScriptSurveyResponses.ts`
   - Keep the current records query exactly as it is (no regression, and no risk that an inner/denied embed hides rows).
   - Run a second, separate read wrapped in try/catch: paged (`fetchAllPages`) `booking_transcriptions` with the same filters, selecting `id` and `bookings!inner(research_call_id, research_calls(campaign_id))`. Build a map id → campaign_id. On any error, or if every embed comes back null because access was denied, use an empty map and mark `campaignIdsReadable = false`.
   - Read `research_campaigns` (`id, name, campaign_key, status`) where `script_id = scriptId`, ordered by name, in try/catch; failure gives `[]`.
   - Add `campaign_id: string | null` to `ScriptSurveyRecord`; return `campaigns` and `campaignIdsReadable`.
2. `src/components/research-insights/ScriptSurveyInsightsDashboard.tsx`
   - "Campaign" select next to the date range: "All campaigns" plus one option per campaign name. Shown only when campaigns ≥ 2 and campaign ids were readable.
   - Value stored in the URL as `?camp=<id>` via `useSearchParams` (keeps the other parameters); an unknown id is treated as All, and choosing All removes the parameter.
   - Filter `records`, `validRecords` and `eligible` by campaign **after** the date filter (AND). Everything that already reads from those values follows automatically: KPI tiles, the funnel (Routed included), Overview/section tabs, grid cards, Script Responses + CSV, open-answer clusters, Word brief.
   - When a campaign is selected: muted note "N calls without a campaign are only included in All campaigns" (only if N > 0, counted within the current date range), and a muted line "AI summary covers all campaigns of this script" below the banner. The banner headline and AI Summary tab stay script-wide; nothing triggers new summaries.
3. `src/utils/generate-script-survey-docx.ts`
   - Optional `campaignName` parameter. When set, the period line reads "… · Period: <range> · Campaign: <name>"; when absent, output is unchanged.

## Open-answer clusters (confirmation)
Filtered response sets produce a different response hash, so `OpenEndedClusters` / `cluster-pe-open-ended` may call AI once per new set and then reuse the cache. Kept as existing behaviour; no change.

## Not touched
Legacy panel, PE / Move-Out / Audience dashboards, Submissions tab, functions, data, RLS, roles, routes, KPI configs, date filter, CR-013 grid and multi-select rendering.

## Acceptance
- `tsgo --noEmit -p tsconfig.app.json` clean.
- "All campaigns" uses the unfiltered arrays, so every number equals today's.
- Sample check (throwaway script in /tmp): records split across 2 campaigns + 1 null; per-campaign counts sum to All minus nulls, and the note count equals the null count.
- Scripts with 0–1 campaigns, or users who cannot read campaigns (supervisors), look exactly as today.
- Nothing published.
