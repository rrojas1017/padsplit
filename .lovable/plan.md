
# Extract Market Information from Call Transcriptions

## ✅ COMPLETED

### Implementation Summary

**Part 1: Future Transcriptions Enhanced**
- Updated `transcribe-call/index.ts` to extract `marketCity` and `marketState` in the AI analysis prompt
- Auto-enrichment logic now updates `bookings.market_city` and `bookings.market_state` after successful transcription

**Part 2: Backfill Function Created**
- Created `backfill-markets-from-transcriptions` edge function
- Successfully tested: 7 out of 20 records enriched in first batch (Atlanta GA, Houston TX, Fort Worth TX, Alpharetta GA, etc.)
- Use batch size of 20 to avoid timeouts

### How to Run Backfill

Call the function multiple times with batch size 20:
```bash
# Run from Supabase dashboard or curl
POST /functions/v1/backfill-markets-from-transcriptions
Body: {"batchSize": 20, "dryRun": false}
```

### Files Modified
- `supabase/functions/transcribe-call/index.ts` - Added marketCity/marketState to prompts + auto-enrichment
- `supabase/functions/backfill-markets-from-transcriptions/index.ts` - New backfill function
- `supabase/config.toml` - Added function config
- `src/types/index.ts` - Added marketCity/marketState to MemberDetails interface

