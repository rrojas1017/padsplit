

## Backfill Pricing Data for Existing Records

### Current State
The Market Intelligence dashboard **already shows** Avg Budget, Avg Quoted Price, and Affordability Gap columns at both state and city level. The `aggregate-market-data` function already reads `pricingDiscussed.quotedRoomPrice` from `call_key_points`. However, existing records don't have this field yet -- only newly transcribed calls will populate it.

### What This Change Does
Create a new backfill edge function that re-reads existing transcriptions and extracts pricing data (`pricingDiscussed`) using the same AI model, then merges it into each record's `call_key_points`. This will populate the Avg Quoted Price and Affordability Gap columns across all historical data.

### Implementation

**1. New Edge Function: `backfill-pricing-data`**
- Fetches `booking_transcriptions` records that have a transcription but are missing `call_key_points.pricingDiscussed`
- Uses Lovable AI (gemini-2.5-flash) to extract pricing info from each transcription
- Merges `pricingDiscussed` into the existing `call_key_points` JSONB field
- Processes in batches with 10-second pacing between records (matching existing batch patterns)
- Self-retriggering: returns `remaining` count so the frontend can loop
- Follows the same architecture as `batch-reanalyze-member-details`

**2. UI: Add "Backfill Pricing" button to Market Intelligence page**
- Similar to the existing "Backfill Markets" button
- Shows count of records missing pricing data
- Progress bar during processing with ability to stop

### Technical Details

- **AI prompt**: Focused extraction asking only for `pricingDiscussed` fields (mentioned, details, agentInitiated, quotedRoomPrice) -- keeps token usage minimal
- **Filter**: Only processes records where `call_key_points` exists but `pricingDiscussed` is missing, and `call_transcription` is not null
- **Batch size**: 20 records per invocation with 5-second delay between AI calls
- **No migration needed**: Data goes into existing `call_key_points` JSONB column
- **Config**: Add `verify_jwt = false` entry in `supabase/config.toml` (handled automatically)

### Files to Create/Modify
- **Create**: `supabase/functions/backfill-pricing-data/index.ts` -- new backfill edge function
- **Modify**: `src/pages/MarketIntelligence.tsx` -- add backfill pricing button + progress UI (mirroring existing backfill markets pattern)

### After Backfill
Once pricing data is populated across historical records, the Market Intelligence dashboard will show meaningful Avg Quoted Price and Affordability Gap values per market, enabling real analysis of whether markets are priced above or below what callers can afford.
