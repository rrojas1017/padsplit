

# Fix Market Backfill to Target Only Imported Records

## Problem Identified
The backfill function is processing **real-time records** that already have market data from the transcription auto-enrichment. It should only target **imported records** (those from the historical file upload) that have been transcribed but are missing market data.

### Current State
| Record Type | Total | Transcribed | Pending | Already Processed |
|-------------|-------|-------------|---------|-------------------|
| Imported | 5,163 | 105 | **105 ← These need backfill** | 0 |
| Real-time | 693 | 657 | 367 | 290 (wasted API calls) |

The 290 "already backfilled" records are all real-time bookings that already had market data from transcription - we spent ~$0.03 on unnecessary AI calls.

## Solution

Update the backfill query to only process imported records without market data:

```typescript
// Before (too broad)
.eq('transcription_status', 'completed')
.eq('market_backfill_checked', false)

// After (targeted to imports only)
.eq('transcription_status', 'completed')
.eq('market_backfill_checked', false)
.not('import_batch_id', 'is', null)  // Only imported records
.is('market_city', null)              // Only those missing market
```

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/backfill-markets-from-transcriptions/index.ts` | Add `import_batch_id` and `market_city IS NULL` filters |

## Expected Outcome

After this fix:
- Backfill will process only the **105 imported transcribed records**
- Real-time records (which already have markets from auto-enrichment) will be skipped
- Estimated cost: ~$0.01 for remaining 105 records

## Technical Details

The updated query will be:

```typescript
const { data: bookingsToProcess, error: queryError } = await supabase
  .from('bookings')
  .select(`
    id,
    member_name,
    market_city,
    market_state,
    booking_transcriptions!inner(
      call_summary,
      call_key_points
    )
  `)
  .eq('transcription_status', 'completed')
  .eq('market_backfill_checked', false)
  .not('import_batch_id', 'is', null)  // Only imported records
  .is('market_city', null)              // Only those missing market data
  .limit(batchSize);
```

This ensures we only spend AI credits on records that actually need market extraction.

