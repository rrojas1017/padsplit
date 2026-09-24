# LP-4 — Non-Booking numbers

## Verified before planning
- `non_booking_insights` has `created_by` and `error_message`, but **no** `triggered_by_user_id` or `is_internal` columns (live DB query). Writing them would make the insert fail, so only `created_by` is saved on the row. `triggered_by_user_id` / `is_internal` already go into the `api_costs` rows (lines 428-437), which stay as they are.
- The tab has **no custom date range**. Its options are thisWeek / lastMonth / thisMonth / last3months / allTime (line 20). The "custom 2025-12-01..2025-12-31" check can't be done in the UI. I'll check it with the RPC call instead, and in the UI with Last Month (currently Aug 2026). Adding a custom picker is out of scope.
- Both child components already accept the props: `NonBookingSummaryCards` takes `stats.hotLeads` (line 9), and the missed-opportunities panel takes `hotLeadsCount` (line 18). Today nothing passes them, so they show 0. **Neither component file changes.**

## 1) src/components/call-insights/NonBookingAnalysisTab.tsx
- **Lines 69-106 `getDateRangeParams`:** build "today" from the America/New_York calendar date using `Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'})`, parsed into a local `Date(y, m-1, d)`. Do not use `new Date('yyyy-MM-dd')`. allTime start becomes `new Date(2024, 0, 1)`. The rest of the date-fns logic and the `format(...,'yyyy-MM-dd')` output stay the same, and the end date stays inclusive.
- **Lines 108-113:** replace `getStatsStartDate` with `getStatsBounds(option)`, which returns `{ start_date, end_date }` (both `null` for allTime).
- **Lines 116-135 stats query:** call `rpc('get_non_booking_stats', { start_date, end_date })`. Read `hot_leads` into `hotLeads`, and use a typed fallback row that includes `hot_leads: 0`. If the generated RPC types don't list `end_date`/`hot_leads` yet, add a narrow local type for the args and result instead of using `any`.
- **Lines 193-203 auto-select:** keep the current selection if it is in `previousInsights`. Otherwise select `previousInsights[0]?.id ?? null`. The dependency on `selectedInsightId` is read through the functional setter, so the effect doesn't loop.
- **Line 399:** `stats` now carries `hotLeads`, so `<NonBookingSummaryCards stats={stats} />` stays unchanged.
- **Lines 408-412:** add `hotLeadsCount={stats.hotLeads}`.

## 2) supabase/functions/analyze-non-booking-insights/index.ts
- **Lines 370-377 parse:** track `parseOk`. After parsing, if `!parseOk` or `rejection_reasons` is not a non-empty array, update the row to `status='failed', error_message='AI response could not be parsed'` (plus `raw_analysis` length only; nothing is logged), then return. It no longer falls through to 'completed'. The api_costs logging for the AI call still runs as today, so the call is still recorded.
- **Lines 496-501 insert:** add `created_by: triggeredByUserId`. This comes from the existing guard: user → userId, internal/cron → null.
- Auth guard (lines 459-462) and the INS-42 date defaults stay byte-identical.

## Checks after implementation
- `npx tsgo --noEmit -p tsconfig.app.json` clean.
- deno check + deploy analyze-non-booking-insights; anon POST {} → 401.
- Read-only RPC checks: Dec 2025 → 387 / 387 / 138 / 340.9 s / 98 hot. All time → hot 846.
- No real analysis run, nothing published.
