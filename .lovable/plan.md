

# Fix: Backfill Loop Stops After 1-2 Iterations

## Root Cause

Two issues combine to kill the backfill loop prematurely:

1. **Edge function runs dangerously close to the 60s gateway timeout**: The internal `MAX_DURATION_MS` is 45s, but after processing + running the "remaining" count query, total response time reaches 47s. If it occasionally exceeds 60s, the gateway returns a 504 or resets the connection.

2. **Frontend loop has no resilience to thrown errors**: When `supabase.functions.invoke` throws (network timeout, connection reset), the error bypasses the `if (error)` check on line 171 and hits the outer `catch` on line 199, which stops the entire loop and hides the progress bar.

## Solution

### 1. Edge Function (`batch-extract-lifestyle-signals/index.ts`)

- Reduce `MAX_DURATION_MS` from 45000 to 35000 (35s), leaving plenty of headroom for the count query and HTTP overhead before the 60s gateway limit.

### 2. Frontend (`CrossSellOpportunitiesTab.tsx`)

Make the loop resilient to transient failures:

- Wrap each iteration's `supabase.functions.invoke` call in its own try/catch so a thrown error (network timeout, 504) doesn't kill the loop
- Add a **max consecutive failures** counter (e.g., 5) -- if 5 calls in a row fail, stop the loop and show an error toast; otherwise, retry after a brief delay (2 seconds)
- Reset the consecutive failure counter on each successful call
- This ensures the progress bar stays visible and the loop keeps retrying through transient gateway hiccups

### Expected Behavior After Fix

Clicking "Backfill" with "All Time" selected will:
- Start processing ~25 records per 35s edge function call
- Auto-retrigger continuously, showing a live progress bar
- Survive transient network/gateway errors by retrying (up to 5 consecutive failures)
- Only stop when all records are processed, the user cancels, or 5 consecutive errors occur

## Files Changed
- `supabase/functions/batch-extract-lifestyle-signals/index.ts` -- reduce MAX_DURATION_MS from 45000 to 35000
- `src/components/call-insights/CrossSellOpportunitiesTab.tsx` -- wrap each loop iteration in try/catch, add consecutive failure counter with retry delay

