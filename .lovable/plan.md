

# Fix: Backfill Query Not Filtering Already-Processed Records

## Root Cause

The edge function query fetches any 50 records with `call_key_points IS NOT NULL`, then filters in JavaScript for those missing `lifestyleSignals`. Most of those 50 records already have the signals, leaving 0 to process per batch -- even though 5,855 truly unprocessed records exist deeper in the table.

## Solution

Filter at the database level using PostgREST's JSON arrow operator so the query only returns records that genuinely lack `lifestyleSignals`.

### Edge Function (`batch-extract-lifestyle-signals/index.ts`)

Replace the current query + in-memory filter approach with a database-level filter:

```text
Current (broken):
  .select(...)
  .not('call_key_points', 'is', null)
  .limit(50)
  -> then JS filter for missing lifestyleSignals (gets 0 results)

Fixed:
  .select(...)
  .not('call_transcription', 'is', null)
  .not('call_key_points', 'is', null)
  .is('call_key_points->lifestyleSignals', null)   // <-- DB-level filter
  .limit(50)
  -> no JS filter needed, all 50 records are guaranteed unprocessed
```

This single change ensures the query skips already-processed records and always returns fresh ones. The in-memory `toProcess` filter becomes unnecessary but can stay as a safety net.

Also fix the "remaining" count query to use the same `is('call_key_points->lifestyleSignals', null)` filter so the progress bar shows accurate numbers.

### No Frontend Changes

The frontend loop and progress bar are correct. Once the edge function returns non-zero `processed` counts consistently, the loop will keep running and the progress bar will update properly.

## Files Changed
- `supabase/functions/batch-extract-lifestyle-signals/index.ts` -- add `.is('call_key_points->lifestyleSignals', null)` to both the main query and remaining count query, remove redundant in-memory filter

