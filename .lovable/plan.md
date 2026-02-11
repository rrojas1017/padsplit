

# Fix: Backfill Infinite Loop and Progress Bar Not Showing

## Root Cause

The edge function fetches records without `lifestyleSignals`, but when a record has a transcription shorter than 50 characters, it gets **skipped without being marked**. The same 3 short-transcription records keep appearing in every batch, the function spins for 45 seconds processing nothing, returns `processed: 0`, and the frontend loop immediately exits -- making the progress bar flash and vanish.

## Solution

### 1. Edge Function (`batch-extract-lifestyle-signals/index.ts`)

Mark skipped records with `lifestyleSignals: []` so they never appear again:

```typescript
if (!transcription || transcription.length < 50) {
  // Mark as processed with empty signals so it's not refetched
  const existingKP = record.call_key_points as any;
  await supabase
    .from('booking_transcriptions')
    .update({ call_key_points: { ...existingKP, lifestyleSignals: [] } })
    .eq('id', record.id);
  totalProcessed++; // Count it so the loop progresses
  continue;
}
```

This ensures every record fetched in a batch gets marked, eliminating the infinite loop.

### 2. Frontend (`CrossSellOpportunitiesTab.tsx`)

No changes needed -- the existing progress bar and auto-retrigger loop are correctly implemented. Once the edge function stops returning `processed: 0` for stuck batches, the loop will progress properly and the progress bar will display as designed.

## Files Changed
- `supabase/functions/batch-extract-lifestyle-signals/index.ts` -- mark short-transcription records with empty `lifestyleSignals` array instead of silently skipping them
