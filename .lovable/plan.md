

# Fix: Market Intelligence Showing Only 988 Records

## Problem
The `aggregate-market-data` backend function fetches bookings with a single query, hitting the default 1,000-row limit. The database contains **5,941 bookings** but only ~1,000 are being processed.

## Solution
Add batch pagination to the edge function using the same `fetchBookingsInBatches` pattern already used across other analysis functions.

## Changes

### 1. Update `supabase/functions/aggregate-market-data/index.ts`
- Replace the single bookings query with a paginated fetch loop using `.range()` with a batch size of 500
- This ensures all 5,941 records are processed instead of just the first 1,000

```text
Current (broken):
  Single query -> max 1,000 rows -> ~988 after filters

Fixed:
  Batch 1: rows 0-499
  Batch 2: rows 500-999
  Batch 3: rows 1000-1499
  ...continues until all rows fetched
  -> All 5,941 records processed
```

### 2. Same file - also paginate transcription fetches
- The transcription fetch already chunks by booking ID (500 at a time), which is good
- But since we'll now have more booking IDs (5,941 vs 1,000), this chunking becomes even more important

### Technical Details
- Add a `fetchAllBookings` helper that loops with `.range(offset, offset + batchSize - 1)` until a batch returns fewer rows than the batch size
- Batch size: 500 (consistent with other functions)
- No UI changes needed -- the page will automatically show the correct totals once the backend returns all data
- The cache will be invalidated automatically since new data will produce different results

### Expected Result
- **Total Records**: ~5,941 (up from 988)
- **States**: More states visible (currently 3,203 records have state data)
- **Cities**: More cities visible (currently 3,673 records have city data)

