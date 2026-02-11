
# Fix: Cross-Sell Tab Not Showing Data

## Problem
The Cross-Sell Opportunities tab shows no data because:

1. **Only 13 out of 5,914 transcriptions** have lifestyle signals extracted -- none from February 2026
2. The backfill function processes only **10 records per click** -- at that rate it would take 590+ manual clicks
3. The "remaining" count in the backfill response is inaccurate, showing misleading numbers
4. No date filtering on the backfill -- it grabs random old records first instead of prioritizing the selected date range

## Solution

### 1. Fix the backfill function to be practical and date-aware

**File: `supabase/functions/batch-extract-lifestyle-signals/index.ts`**

- Accept `startDate` and `endDate` parameters so it prioritizes records in the user's selected date range
- Increase default batch size from 10 to 50 for faster processing
- Add a self-retriggering loop (process multiple batches in one invocation, up to ~45 seconds)
- Fix the "remaining" count to only count records that actually lack lifestyle signals
- Order by `booking_date DESC` so newest records are processed first

### 2. Fix the "remaining" count query

Currently counts ALL records with `call_key_points`, not just those missing `lifestyleSignals`. Replace with a filtered count that checks for records where `lifestyleSignals` is absent from the JSON.

### 3. Update the frontend backfill trigger to pass date range

**File: `src/components/call-insights/CrossSellOpportunitiesTab.tsx`**

- Pass `startDate` and `endDate` from the current date filter to the backfill function
- Show better progress feedback (e.g., "Processing batch... X processed, Y remaining")
- Auto-refresh data after backfill completes

## Technical Details

### Edge Function Changes (`batch-extract-lifestyle-signals/index.ts`)

```text
Current flow:
  Fetch 10 random records -> process -> return

New flow:
  Accept startDate/endDate params
  Loop (up to 45 seconds):
    Fetch 50 records matching date range, ordered by booking_date DESC
    Filter out those already having lifestyleSignals
    Process batch with AI
    Track total processed
  Return processed count + accurate remaining count
```

Key changes:
- Add `startDate`/`endDate` body params, join with `bookings` table to filter by `booking_date`
- Process in a loop until timeout (~45s) or no more records
- Fix remaining count: query records WITHOUT `lifestyleSignals` in their `call_key_points` JSON
- Increase batch size to 50

### Frontend Changes (`CrossSellOpportunitiesTab.tsx`)

- Pass the active date range (`startDate`, `endDate`) when invoking the backfill
- Increase timeout expectation (the function will run longer now)
- Show a more informative toast with processed/remaining counts

## Files Changed
- `supabase/functions/batch-extract-lifestyle-signals/index.ts` -- date filtering, larger batches, self-looping, accurate remaining count
- `src/components/call-insights/CrossSellOpportunitiesTab.tsx` -- pass date range to backfill, better feedback
