

## Fix: Budget Data Missing on "All Time" View

### Problem
When selecting "All Time", Market Intelligence shows no budget data (all dashes). This is because the system fetches 5,960 bookings and then tries to look up their transcriptions using URL query parameters with 500 UUIDs per chunk. Each UUID is 36 characters, making URLs over 18,000 characters long -- which exceeds HTTP limits and causes all transcription lookups to silently fail.

The "This Month" filter works fine because it only has ~146 records (1 small chunk that fits in the URL).

### Solution
Reduce the transcription chunk size from 500 back to **100 UUIDs per chunk** while keeping the parallel fetch approach for speed. This keeps URLs well within limits (~4,000 characters per request) and still processes all chunks simultaneously.

### What Changes
- **File**: `supabase/functions/aggregate-market-data/index.ts`
  - Change `TRANS_CHUNK` from `500` to `100`
  - No other changes needed -- the parallel `Promise.all()` approach stays, so performance remains fast

### Expected Result
After this fix, selecting "All Time" will show budget data (with green/red color coding) for all markets, just like it already works for "This Month" and other filtered date ranges.

### Technical Detail
The parallel approach means even with 60 chunks (5,960 bookings / 100 per chunk), all requests fire simultaneously, so total load time stays similar to the current behavior with fewer, larger chunks.

