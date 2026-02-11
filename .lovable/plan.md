
# Backfill Market Data for 2,194 Unmapped Records

## Current State
- **2,194 records** have completed transcriptions but no market city/state and haven't been checked yet
- **372 records** were already checked in previous runs
- An existing `backfill-markets-from-transcriptions` function exists but processes only 10 records per call with sequential AI requests -- too slow for 2,194 records

## Plan

### 1. Update `backfill-markets-from-transcriptions` Edge Function

**Key changes:**
- Increase default batch size from 10 to **50** per invocation
- Use `EdgeRuntime.waitUntil()` to return an immediate response while processing continues in the background (same pattern used by Member Insights and other analysis functions)
- Add a progress tracking mechanism: write progress to a `market_backfill_progress` row in `market_intelligence_cache` so the UI can poll status
- Process AI calls with **5 concurrent requests** instead of sequential (use Promise batching) to speed up ~5x while respecting rate limits

### 2. Add a "Backfill Markets" Button to the Market Intelligence Page

Add a button in the filters bar on `src/pages/MarketIntelligence.tsx` that:
- Shows the count of unmapped records (queries bookings where `market_city IS NULL AND market_backfill_checked = false AND transcription_status = 'completed'`)
- Triggers the backfill function with `batchSize: 50`
- Auto-polls for progress and shows a progress indicator
- Automatically re-calls the function when a batch completes until all records are processed (self-chaining)
- Disables itself while processing is active

### 3. Self-Chaining Loop

Since edge functions have a time limit, the function will process 50 records per invocation. The frontend will:
1. Call backfill with `batchSize: 50`
2. On response, check if `remaining > 0`
3. If yes, automatically trigger the next batch after a 2-second delay
4. Repeat until `remaining === 0`
5. Then refresh the Market Intelligence data

This approach processes all 2,194 records across ~44 automatic iterations (~22 minutes total with concurrency).

### Technical Details

**Edge Function Changes (`supabase/functions/backfill-markets-from-transcriptions/index.ts`):**
- Add `remaining` count to the response (query count of unchecked records)
- Remove the `import_batch_id` filter so it covers all record types (future-proofing)
- Add parallel AI processing: batch 5 records at a time using `Promise.all`
- Reduce inter-call delay from 500ms to 200ms (within concurrency group)

**Frontend Changes (`src/pages/MarketIntelligence.tsx`):**
- Add a "Backfill Markets" button with record count badge
- Add state for tracking backfill progress (processed, total, isRunning)
- Add auto-chaining logic that re-triggers the function until complete
- Show toast notifications on completion

**Estimated Processing:**
- ~2,194 records / 50 per batch = ~44 batches
- ~50 records x 5 concurrent = ~10 AI call rounds per batch
- ~22 minutes total wall time
- Estimated AI cost: ~$0.22 (2,194 x $0.0001/call)
