

## Fix: Budget Data Still Missing on "All Time"

### Root Cause
The previous fix (reducing chunk size to 100) hasn't fully resolved the issue. The `.in('booking_id', chunk)` approach encodes UUIDs directly into the URL query string, which hits HTTP URL length limits even at 100 IDs per chunk. The error logs confirm chunks are still failing with `TypeError: error sending request`.

### Why This Happens
- 5,960 bookings exist, and 5,933 have transcriptions (99.5%)
- Using `.in()` with UUID lists creates extremely long URLs regardless of chunk size
- Failed chunks return 0 transcriptions, so no budget/sentiment data appears

### Solution
Replace the chunked `.in()` approach with **range-based pagination** (the same pattern already used for fetching bookings). Since nearly every booking has a transcription, fetching all transcriptions is actually more efficient than filtering by ID.

### Changes

**File: `supabase/functions/aggregate-market-data/index.ts`**

Replace the transcription fetching logic (lines 76-96) with:

```typescript
// Fetch all transcriptions with key points using range-based pagination
const allTranscriptions: any[] = [];
let transOffset = 0;
while (true) {
  const { data: transData, error: transError } = await supabase
    .from("booking_transcriptions")
    .select("booking_id, call_key_points")
    .not("call_key_points", "is", null)
    .range(transOffset, transOffset + BATCH_SIZE - 1);

  if (transError) {
    console.error("Transcription batch error:", transError.message);
    break;
  }
  if (!transData || transData.length === 0) break;
  allTranscriptions.push(...transData);
  if (transData.length < BATCH_SIZE) break;
  transOffset += BATCH_SIZE;
}
```

This uses the existing `BATCH_SIZE` (500) with `.range()` pagination -- the same proven pattern used for bookings on lines 56-68. No URL length issues since `.range()` only adds simple numeric parameters.

### What Gets Removed
- The `TRANS_CHUNK` variable
- The `chunks` array construction
- The `Promise.all()` parallel `.in()` fetching

### Why This Is Better
1. **No URL length limits** -- `.range()` uses offset/limit, not UUID lists
2. **Simpler code** -- same pagination pattern as bookings
3. **More reliable** -- no silent chunk failures
4. **Same performance** -- sequential batches of 500 rows are fast for 5,933 records (~12 round trips)

### Expected Result
After deployment, selecting "All Time" will correctly show budget data with green/red color coding across all markets, matching the behavior of filtered date ranges.

