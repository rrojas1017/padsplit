

# Speed Up Market Intelligence Loading

## Problem
The `aggregate-market-data` edge function makes **72 sequential database queries** (12 booking batches + 60 transcription chunks) to process ~6,000 records. This takes 13+ seconds on every cache miss (every 15 minutes).

## Solution: Two optimizations that reduce query count from 72 to ~24

### 1. Increase transcription chunk size from 100 to 500
The current chunk size of 100 was set to avoid URL length limits, but Supabase `.in()` sends the filter in the request body (POST), not the URL. Increasing to 500 reduces transcription fetches from 60 chunks to 12 chunks.

**File:** `supabase/functions/aggregate-market-data/index.ts`
- Change `TRANS_CHUNK = 100` to `TRANS_CHUNK = 500` (line 79)

### 2. Fetch transcription chunks in parallel (not sequentially)
Currently, chunks are fetched one at a time in a `for` loop. Using `Promise.all()` to fetch all chunks concurrently will reduce wall-clock time from ~12 round-trips to ~1 round-trip (all fire simultaneously).

**File:** `supabase/functions/aggregate-market-data/index.ts`
- Replace the sequential `for` loop (lines 81-89) with parallel `Promise.all()` execution

### 3. Extend cache TTL from 15 to 30 minutes
Market data doesn't change frequently. Doubling the cache window halves the frequency of slow refreshes.

**File:** `supabase/functions/aggregate-market-data/index.ts`
- Change `15 * 60 * 1000` to `30 * 60 * 1000` (line 45)

## Expected Impact
- **Query count**: 72 sequential queries reduced to ~24 parallel queries
- **Load time**: ~13 seconds reduced to ~3-4 seconds on cache miss
- **Cache misses**: Half as frequent (every 30 min instead of 15)

## Files Changed
- **Edit:** `supabase/functions/aggregate-market-data/index.ts` -- increase chunk size, parallelize fetches, extend cache TTL

