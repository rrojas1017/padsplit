# BKG-P3 — Dashboard, leaderboard and one timezone rule

Frontend only. No migrations, RLS, triggers, DB functions or edge functions. Nothing is published.

## Verified current state
- `BookingsContext` loads only the last 90 days (lines 44-67). Leaderboard (line 16), MyPerformance (line 122) and EditBooking (line 38) read only that context, so they are empty today.
- `useDashboardData` has no `record_type` filter, stops at 25,000 rows (line 97), and uses the context for 'today' (lines 63-66). It fetches only `[start, end]`, so the "previous period" rows the KPI and leaderboard maths look for are never loaded, and every change shows +100%.
- The same-time "today" comparison uses browser hours (dashboardCalculations lines 116-128).
- MyPerformance has its own preset logic based on `new Date()` (lines 45-102) and builds its chart from `today = new Date()` (lines 152, 209-218).
- `LeaderboardTable` subtitle is hard-coded to "Top performers this week" (line 30).
- `Booking` has no `importBatchId`, and the dashboard doesn't select `import_batch_id`.

## (a) New: src/utils/businessTime.ts
- `BUSINESS_TZ = 'America/New_York'`.
- `businessToday(): string` — the ET calendar date as `yyyy-MM-dd`, from `Intl.DateTimeFormat('en-CA', { timeZone })`.
- Pure string date maths on UTC-noon Date objects: `addDaysStr`, `daysBetween` and `startOfWeekStr` (weeks start Monday). Dates are never parsed as local midnight.
- `resolveRange(preset, custom?) → { from: string | null, to, prevFrom: string | null, prevTo: string | null }`, all ends inclusive:
  - today: previous = yesterday.
  - yesterday: previous = the day before.
  - 7d: today-6..today; previous = the 7 days before.
  - 30d: today-29..today; previous = the 30 days before.
  - month: 1st..today; previous = previous month days 1..min(day of month, length of previous month).
  - all: from = null, no previous.
  - custom: the picked calendar dates, read from the Date's local Y/M/D (they come from the date picker). Previous = the same number of days immediately before.
- `presetLabel(preset)` returns the picker labels ("Today", "Yesterday", "Last 7 days", "Last 30 days", "This month", "All Time", "Custom range").
- `etMinutesOfDay(date: Date): number` gives the minutes since ET midnight.
- `ymdToLocalDate(s)` is display only, built as `new Date(s + 'T00:00:00')`.

## (b) Data hook: src/hooks/useDashboardData.ts
- **Lines 9-20:** add `import_batch_id` to the columns. **Line 60:** map it to `importBatchId`.
- **Lines 63-66:** delete `needsDirectQuery`. Every preset, including 'today', queries the database.
- **Lines 71-101 `fetchAllBookings(bounds, agentId?)`:**
  - `.eq('record_type','booking')`.
  - `.gte('booking_date', prevFrom ?? from)` when there is a lower bound, and `.lte('booking_date', to)`.
  - `.eq('agent_id', agentId)` when an agent id is given.
  - `.order('booking_date', { ascending: false }).order('id', { ascending: false })`, paginated by 1000 with no row cap.
- **Lines 103-163:** signature `useDashboardData(dateRange, customDates?, options?: { agentId?: string; skipPrevious?: boolean; enabled?: boolean })`.
  - The return shape stays `{ bookings, isLoading }`.
  - The cache key includes the bounds and agent id.
  - `useBookings` is no longer used here.

## Calculations: src/utils/dashboardCalculations.ts
- **Lines 1-2 and 51-93:**
  - `getEasternNow` stays exported but is built on `businessToday()` plus the ET time.
  - `getDateRangeFromFilter` keeps its signature. It wraps `resolveRange` and returns `start`/`end` Dates made from the strings with `ymdToLocalDate`.
  - For 'all', the start is the earliest `bookingDate` in the rows when given, otherwise `2024-01-01`, so the chart doesn't loop from 2020.
- **Lines 32-39 `filterBookingsByDateRange` and 24-30 `filterBookingsByDate`:** compare `format(bookingDate,'yyyy-MM-dd')` strings with the range strings.
- **Lines 4-11 `filterActualBookings`:** add `b.recordType === 'booking'` (rule 3).
- **Lines 95-225 `calculateKPIData`:**
  - The previous period comes from `resolveRange` (prevFrom/prevTo).
  - The same-time "today" rule uses `etMinutesOfDay(createdAt) <= etMinutesOfDay(now)`.
  - For 'all', every KPI gets `hideChange: true`, change 0, and the period label "All Time".
  - Period labels come from `presetLabel`.
- **Lines 260-335 `calculateLeaderboard`:** the previous period comes from `resolveRange`; for 'all', change = 0.
- **Lines 382-495 `calculateInsightsData`:**
  - today, yesterday, week start (Monday) and month start are all `resolveRange`/`businessToday` strings.
  - "Pending move-ins next 7 days" leaves out rows where `importBatchId` is set and `moveInDate` = `bookingDate` (HubSpot placeholders). This applies to that insight only.
- **Line 497 `calculateNonBookingCount`:** uses the same string range. Non-Booking rows still pass, because the fetch keeps `record_type='booking'`.

## Types and KPI card (small, additive)
- **`src/types/index.ts`:** `Booking` (line 93) gains `importBatchId?: string`, and `KPIData` (line 170) gains `hideChange?: boolean`.
- **`src/components/dashboard/KPICard.tsx` lines 47-56:** when `hideChange` is set, the "vs previous" line and the % pill are not rendered. Everything else looks the same.

## Pages
- **`src/pages/Dashboard.tsx`:**
  - Line 43 stays `useDashboardData(dateRange, customDates)`.
  - Add a second call for the insights panel: `useDashboardData('custom', { from: min(monthStart, weekStart, yesterday), to: today }, { skipPrevious: true })`. The "today vs yesterday", "this week" and "pending move-ins" cards then stay correct for any selected range.
  - Line 79 `calculateInsightsData` uses those rows.
  - Line 157 becomes `<LeaderboardTable data={leaderboard} subtitle={presetLabel(dateRange)} />`.
- **`src/pages/Leaderboard.tsx`:**
  - Line 16: replace `useBookings()` with `useDashboardData(dateRange, customDates)`, and drop the unused import at line 8.
  - Line 120: add `subtitle={presetLabel(dateRange)}`.
- **`src/pages/MyPerformance.tsx`:**
  - Lines 45-102: delete `getDateRangeFromFilterLocal`/`getPreviousPeriod`.
  - Line 122: use `useDashboardData(dateFilter, customDates, { agentId: myAgent?.id, enabled: !!myAgent || user.role !== 'agent' })`. For agents the agent filter is added. Admins and supervisors keep all visible rows, so rank still works for them.
  - Lines 152-165 and 175-205: period filters compare `yyyy-MM-dd` strings from `resolveRange`.
  - Lines 208-218: the chart walks back from `businessToday()`.
  - The existing `dateFilter === 'all'` checks already hide the change.
  - `getFilterLabel` stays as it is (copy unchanged).
- **`src/components/dashboard/LeaderboardTable.tsx` lines 5-10 and 30:** new optional `subtitle` prop that defaults to the current text.
- **`src/pages/EditBooking.tsx` line 62:**
  - `booking = contextBooking ?? fetchedBooking`.
  - A new effect loads the row by id with `supabase.from('bookings').select(...).eq('id', id).maybeSingle()` when it isn't in the context, then maps it the same way the context does.
  - A loading state shows while fetching. "Booking not found" appears only after the fetch returns nothing.
  - On save, the existing `updateBooking` still runs.

## Pages still using their own date logic (not changed now)
components/audience-survey/generateAudienceSurveyReport.ts, components/billing/InvoiceGenerator.tsx, components/call-insights/BookingInsightsTab.tsx, CrossSellOpportunitiesTab.tsx, NonBookingAnalysisTab.tsx, NonBookingTrendChart.tsx, components/dashboard/DateRangePicker.tsx, components/research-insights/ReasonCodeChart.tsx, hooks/useBillingData.ts, hooks/useMyBookingsData.ts, hooks/usePromoCodes.ts, pages/MemberInsights.tsx, pages/MyQA.tsx, pages/PublicWallboard.tsx, pages/QADashboard.tsx, pages/Wallboard.tsx, plus `contexts/BookingsContext.tsx` (90-day window, still used by Reports and other pages).

## Acceptance (custom 2026-05-01..2026-05-31)
- Total bookings 253 (+23% vs 205).
- All Time total 3,795, with the % change hidden.
- Leaderboard: Anel 100, Emmanuel 79, Megane 74.
- EditBooking opens a booking dated 2026-05-15.

## After implementation
- `npx tsgo --noEmit -p tsconfig.app.json` clean.
- Read-only SQL spot-checks of the targets.
- Report the results.
