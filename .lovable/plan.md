
# Unify Backfill into a Single Auto-Retriggering Flow with Date Support

## Problem
There are currently two separate backfill buttons: "Backfill" (single call, date-filtered) and "Backfill All" (auto-retrigger, no dates). The edge function also lost date filtering in the last edit, so even the date-filtered button doesn't actually filter by date.

## Solution
Restore date filtering in the edge function and consolidate both buttons into a single "Backfill" action that auto-retriggers until completion, respecting the selected date range.

## Changes

### 1. Edge Function (`supabase/functions/batch-extract-lifestyle-signals/index.ts`)

Restore the `bookings` table join and date filters so the function can process records within a specific date range:

- Re-add the inner join: `.select('id, booking_id, call_transcription, call_key_points, bookings!inner(booking_date)')`
- Re-add date filter conditions when `startDate`/`endDate` are provided
- Keep the `.is('call_key_points->lifestyleSignals', null)` DB-level filter (the fix from the previous iteration)
- Apply the same date filters to the "remaining" count query so progress tracking is accurate for the selected period

### 2. Frontend (`CrossSellOpportunitiesTab.tsx`)

- Remove the separate `runBackfill` (single-call) function
- Remove the "Backfill All" button -- keep only one "Backfill" button
- Modify `runFullBackfill` to accept and pass `startDate`/`endDate` from the current date range selector to every edge function call
- This means clicking "Backfill" always auto-retriggers with the progress bar, filtered to the selected date range
- If "All Time" is selected, no date filters are sent (equivalent to the old "Backfill All" behavior)

### Result
One button, one flow: click "Backfill", it processes all records in the selected date range with a live progress bar and auto-stops when done.

## Files Changed
- `supabase/functions/batch-extract-lifestyle-signals/index.ts` -- restore date filtering on both the main query and remaining count query
- `src/components/call-insights/CrossSellOpportunitiesTab.tsx` -- remove `runBackfill`, consolidate into `runFullBackfill` with date params, remove extra button
