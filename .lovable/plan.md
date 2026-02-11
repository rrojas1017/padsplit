

# Auto-Backfill All Records with Progress Bar

## Overview
When clicking "Backfill All", the frontend will automatically loop -- calling the edge function repeatedly until all records are processed -- while displaying a live progress bar.

## Changes

### 1. Edge Function (`batch-extract-lifestyle-signals/index.ts`)
- No date filtering when called in "backfill all" mode (no startDate/endDate passed)
- Add a `totalEligible` count in the response (total records that have `call_key_points` and `call_transcription` but no `lifestyleSignals`) so the progress bar knows the denominator
- Keep the existing 45-second loop per invocation

### 2. Frontend (`CrossSellOpportunitiesTab.tsx`)
- Add new state: `backfillProgress` with `{ processed: number, total: number, running: boolean }`
- Add a "Backfill All Records" button (separate from the date-filtered backfill)
- `runFullBackfill` function:
  - First call: gets initial `remaining` count as the `total`
  - Loops: calls the edge function (no date filter), accumulates `processed`, updates progress
  - Stops when `remaining === 0` or an error occurs
  - Refreshes data after completion
- Progress bar UI:
  - Shown only while backfill is running
  - Uses the existing `Progress` component from `src/components/ui/progress.tsx`
  - Shows: progress bar + "X of Y processed (Z%)" text + elapsed time
  - Styled consistently with the existing card design

### UI Layout
```text
+----------------------------------------------------------+
| [Progress bar =====>                          ]           |
| 1,240 of 5,800 processed (21%) -- 2m 15s elapsed         |
| [Cancel]                                                  |
+----------------------------------------------------------+
```

This card appears above the summary stats when the backfill is active, and disappears when complete.

### 3. Cancel Support
- An `abortRef` ref allows the user to cancel the loop at any time
- Clicking "Cancel" sets the ref to `true`, the loop exits on next iteration

## Technical Details

### Frontend auto-retrigger loop
```text
runFullBackfill():
  1. Call edge function once with { batchSize: 50 } (no dates) to get initial remaining count
  2. Set total = processed + remaining
  3. Loop while remaining > 0 and !abortRef:
     a. Call edge function with { batchSize: 50 }
     b. Accumulate totalProcessed += result.processed
     c. Update progress state
     d. If result.processed === 0, break (nothing left)
  4. Show completion toast
  5. Refresh aggregated data
```

### Edge function change
- When no `startDate`/`endDate` provided, skip date filters (already works this way)
- Add `totalEligible` to response: count of all records with transcription + key_points but missing lifestyleSignals

## Files Changed
- `supabase/functions/batch-extract-lifestyle-signals/index.ts` -- add `totalEligible` to response
- `src/components/call-insights/CrossSellOpportunitiesTab.tsx` -- add progress bar, auto-retrigger loop, cancel button

