

# Fix: Pain Point Filter Returns No Results

## Root Cause

The `detected_issues` column was added but **no records have been tagged yet**. The backfill function that processes historical records crashes because it builds a `.in('booking_id', bookingIds)` query with up to 500 UUIDs, exceeding the HTTP URL length limit for Supabase REST API calls.

## Fix

### 1. Update `supabase/functions/backfill-detected-issues/index.ts`

Two changes:

- **Reduce main batch size** from 500 to 200
- **Sub-batch the transcription lookups** by adding a `fetchTranscriptionsInChunks()` helper that splits the `.in()` query into chunks of 50 IDs at a time, then merges the results

This prevents the URL from exceeding length limits while still processing all records efficiently.

### 2. Deploy and Run

After fixing, deploy the function and execute it to tag all historical records with their detected issues. Once complete, the pain point filter in Reports will return matching records.

## Files to Edit

- `supabase/functions/backfill-detected-issues/index.ts` -- add chunked fetching, reduce batch size

## Expected Result

After running the backfill, records with transcription data will have their `detected_issues` column populated (e.g., `["Payment & Pricing Confusion", "Transportation Barriers"]`), and the Reports filter will return matching records.
