# CR-015 — Supervisors get the Campaign filter

## Files to touch
1. `src/hooks/useScriptSurveyResponses.ts` (only the two campaign reads + map building)
2. `src/integrations/supabase/types.ts` — the two functions are not in it today; regenerate the types from the live database (they are already applied), so no new `any` casts are needed.
3. `supabase/migrations/20261029150000_capture_cr015_script_campaign_functions.sql` — capture only, written byte-for-byte from the request with one trailing newline, never executed. Report its md5 (expected `f9be5ed2ed3cca333e91ca533fbf031e`).

## Hook change
- Campaign map, paged:
  ```ts
  fetchAllPages((from, to) =>
    supabase.rpc('get_script_survey_campaign_map', { p_script_id: scriptId })
      .range(from, to))
  ```
  The function orders by `booking_id`, so pages are stable. Build `Map<booking_id, campaign_id>`; each record looks up `campaignMap.get(row.booking_id)` instead of the transcription id.
- Campaign list: `supabase.rpc('get_script_campaigns', { p_script_id: scriptId })`.
- Unchanged: the three reads stay in one `Promise.allSettled`; a rejected/errored/empty map gives `campaignIdsReadable = false` and an empty map; a failed list gives `[]`; neither fails the records query; same `console.warn('[script-survey] campaign map unavailable', code)` (code only); filter still shows only with 2+ campaigns and readable ids; records query errors still throw.
- If records rows don't already select `booking_id`, add it to the existing select (no other select change).

## Not changed
RLS/policies, other functions, edge functions, data, CR-014 dashboard UI/filter logic, supervisor record visibility.

## Acceptance
`tsgo --noEmit -p tsconfig.app.json` clean; md5 reported; nothing published.
