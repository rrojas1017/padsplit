# P6-B — no invented move-in dates on HubSpot import; NULL-safe readers

No migrations, SQL, RLS or config changes. Not published. No booking rows are touched. Bookings that have a move-in date behave exactly as they do today. Display rule for a missing move-in date: "—" in tables and cards, "Not recorded" in notifications.

## 1) Import and type
- `src/utils/hubspotCallParser.ts` line 410: `move_in_date: null`.
- `src/types/index.ts` line 96: `moveInDate: Date | null`.

## 2) Mapping helpers (a missing date maps to null, never to a Date)
Pattern: `b.move_in_date ? new Date(b.move_in_date + 'T00:00:00') : null`.
- `src/hooks/useDashboardData.ts` line 23.
- `src/contexts/BookingsContext.tsx` line 83 (read). Line 188 (add) sends null when moveInDate is null. Line 232 (update) changes to `if (updates.moveInDate !== undefined)`, writing the formatted date or null.
- `src/hooks/useMyBookingsData.ts` line 107 (read). Lines 163–165 (write) send null when moveInDate is null.
- `src/hooks/useReportsData.ts` line 365.
- `src/pages/PublicWallboard.tsx` line 79.
- `src/pages/ImportBookings.tsx` line 169: left unchanged. Excel import rows always have a parsed move-in date; `excelParser` rejects rows without one.
- `src/hooks/useChurnPrediction.ts` lines 76 and 86: `moveInDate` stays a string, because the step 5 filter guarantees it is non-null.

## 3) Readers
- `src/pages/MyBookings.tsx` line 404: shows "—" when the date is null.
- `src/components/dashboard/ChurnWarningPanel.tsx` line 90: shows "—" when the date is null.
- `src/utils/dashboardCalculations.ts` lines 437–440: return false when moveInDate is null (not "moving in this week"). The existing HubSpot placeholder skip stays.
- `src/utils/followUpPriority.ts` line 13: type becomes `Date | null`. The existing guard at line 71 is kept.
- `src/utils/churnPrediction.ts` line 18: type becomes `string | null`. Lines 85–95: when the date is null, the rush-booking signal (the only move-in-based signal) is skipped. It is not pushed, so no NaN appears.
- `src/components/reports/ContactProfileHoverCard.tsx` line 47: prop becomes `Date | null`. The line 115 guard already returns early; props are passed on to the dialogs as `?? undefined`.
- `src/components/reports/SendSMSDialog.tsx` line 33 and `SendEmailDialog.tsx` line 34: prop becomes `Date | null`. Their existing `moveInDate ? format : ''` guards (lines 76 and 69) already cover null.
- `src/pages/Reports.tsx`:
  - Line 364 (CSV/Excel export): an empty cell when the date is null.
  - Line 1366 (table cell): "—" when the date is null.
  - Lines 1138 and 1380: pass the value through; the component types now accept null.
  - Line 1488: `moveInDate` becomes null instead of `String(null)`.

## 4) Churn query
`src/hooks/useChurnPrediction.ts` line 26: add `.not('move_in_date', 'is', null)`.

## 5) EditBooking
`src/pages/EditBooking.tsx`:
- Line 109: `setMoveInDate(booking.moveInDate ?? undefined)`, so the picker shows "Select date" (lines 272–276 already handle an empty value).
- Lines 144–147: a move-in date is required only when the status is Pending Move-In, Moved In or Postponed.
- Line 154: sends `moveInDate ?? null`, so the update writes NULL.

## 6) Edge functions (deploy only these two)
- `notify-moved-in` lines 76–77: `formatDate` gets a label for missing dates. Line 91 (the email row) and line 186 (the Coverall description) print "Not recorded" when the move-in date is null. `booking_date` keeps printing 'N/A'.
- `aggregate-market-data` line 103: `move_in_date` is selected but never used in any calculation. No calculation depends on it, so there is nothing to exclude. The only edit is removing it from the select list to make that explicit. All counts stay the same.

## Left unchanged (checked)
- `AddBooking.tsx`: still requires a move-in date.
- `ImportBookings.tsx` and `excelParser.ts`: parsed move-in dates are always present.
- `MemberDetailsCard.tsx`, `ContactProfileHoverCard` `memberDetails.moveInDate`, and `types` `MemberDetails.moveInDate`: an AI-extracted text string that is only displayed as text and already guarded.
- Calculator files (`MoveInCalculatorForm`, `PaymentSchedulePreview`): local state, not booking data.
- `useReportsData` lines 12, 65 and 189–193: sort and filter only. PostgREST sorts nulls last and range filters exclude nulls, which matches the rule.
- `Reports.tsx` lines 128–268 and 615: filter state only.

## Verification
- `tsgo` must be clean.
- `deno check` both functions, then deploy them.
- Report the exact changed line ranges per file.
- roadmap.md updated. No rows updated; nothing published.
