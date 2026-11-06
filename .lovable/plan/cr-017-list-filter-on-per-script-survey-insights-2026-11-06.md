# CR-017 — "List" filter on per-script survey insights

Frontend only. No migrations, SQL, policies, functions or edge functions. No new dependencies. Nothing published.

## Files
1. `src/integrations/supabase/types.ts` — regenerate (auto) so `dialer_lists`, `get_script_survey_list_map`, `get_script_lists` appear.
2. `src/hooks/useScriptSurveyResponses.ts`
3. `src/components/research-insights/ScriptSurveyInsightsDashboard.tsx`
4. `src/utils/generate-script-survey-docx.ts` (one optional param)

## 1. Hook
- Extend the existing `Promise.allSettled` (records, campaign map, campaigns) with two more reads, all started together:
  - `fetchAllPages` over `supabase.rpc('get_script_survey_list_map', { p_script_id }).range(from, to)`.
  - `supabase.rpc('get_script_lists', { p_script_id })`.
- Best-effort: rejection or `error` → `console.warn('[script-survey] list map unavailable', code)` (code only), empty map / `[]`. Records failure rules unchanged.
- Map `booking_id → list_id`; `listIdsReadable = true` when any row carries a list id.
- `ScriptSurveyRecord` gains `list_id: string | null` (looked up by the same key as `campaign_id`).
- New exported `ScriptSurveyList { campaign_id; list_id; name; sort_order }`; hook returns `lists` and `listIdsReadable`.

## 2. Dashboard
- `showListFilter = lists.length >= 1`.
- Offered lists = all lists, or only `selectedCampaign`'s lists when a campaign is chosen. Labels show the name only (list code is never shown).
- Options: "All lists" (default), one per offered list, "No list".
- URL `?list=<list_id>` / `?list=none`; unknown value, or a list not in the offered set (e.g. after changing campaign) → resolves to "All lists". When the campaign changes and the current list is not offered, `?list` is removed in the same URL update.
- Filter chain: date → campaign → list (AND), applied in the existing `byCampaign` step (renamed `byFilters`), so `records`, `validRecords`, `eligible` feed KPI tiles, funnel (Routed included), tabs, grid cards, responses + CSV, open-answer clusters and the Word brief exactly as campaign does today. Submissions tab and AI summary untouched.
  - Specific list → `r.list_id === id`; "No list" → `!r.list_id`.
- Notes (counted on date + campaign filtered records, ignoring the list selection):
  - unnamed: records with a list id not in `lists` → "N calls come from lists without a name" (shown when N > 0).
  - empty: records with no list id → "N calls arrived without a list (the dialer did not send it)" (shown when N > 0 and the filter is visible).
- Select placed next to the Campaign select, same styling.

## 3. Word brief
- Add optional `listName?: string`; period line appends ` · List: <name>` (or `List: No list`) after the Campaign part. Dashboard passes it only when a list is selected.

## Not changed
Campaign filter behaviour, AI summary, Submissions tab, other dashboards, legacy panel, RLS, auth, routes, edge functions, database objects.

## Checks
`tsgo --noEmit -p tsconfig.app.json` clean.
