
# Plan: Reset Stuck Processing Record and Retry Failed Transcriptions

## Current Status Assessment

### Stuck Processing Record
- **Booking ID**: `175e06db-cf21-4e4e-8453-552e5a851db5`
- **Member**: Jose Ortiz
- **Date**: 2026-01-28
- **Status**: `processing` (stuck)
- **Kixie Link**: Valid
- **Error Message**: None (indicates it's silently stuck in the processing state)

### Failed Transcriptions
- **Count**: 30 records with `transcription_status = 'failed'`
- **Error Patterns**:
  - **18 records**: "Access denied to audio file (403). The recording link may have expired"
  - **5 records**: "Unexpected end of JSON input"
  - **4 records**: "AI summary error: 402" (payment/quota issues)
  - **2 records**: "Processing timeout - the audio file may be too large"
  - **1 record**: "AI summary error: 500"

---

## Recovery Strategy

### Phase 1: Reset Stuck Record
The stuck record is likely hung in the database with `transcription_status = 'processing'` but no active job. We'll:

1. **Reset status to `pending`**: Clear the stuck state
2. **Clear error message**: Prepare for fresh attempt
3. **Trigger retry**: Send to `batch-retry-transcriptions` edge function to re-process

**SQL Operation**:
```sql
UPDATE bookings 
SET transcription_status = 'pending', transcription_error_message = null
WHERE id = '175e06db-cf21-4e4e-8453-552e5a851db5';
```

### Phase 2: Retry Failed Transcriptions
The 30 failed records fall into two categories:

#### A. Expired Links (18 records - likely unrecoverable)
- Error: "Access denied to audio file (403)"
- **Action**: Mark these as `permanent_failure` or review with PadSplit to confirm links are indeed expired
- **Note**: These cannot be retried without fresh Kixie links

#### B. Transient Failures (12 records - retryable)
- **4 records**: "AI summary error: 402" (quota/billing - likely temporary)
- **5 records**: "Unexpected end of JSON input" (parsing errors - may succeed on retry)
- **2 records**: "Processing timeout" (temporary service overload)
- **1 record**: "AI summary error: 500" (server error - likely temporary)

**Action**: Use `batch-retry-transcriptions` edge function to retry these 30 records. The function will:
- Reset status to `pending`
- Re-trigger the transcription pipeline
- Process with 30-second pacing (to avoid rate limits)
- Skip TTS for batch operations (cost efficiency)
- Each record takes ~1 min processing + 30s wait = ~31s per record
- **Total time**: 30 records × 31s ≈ **15 minutes**

---

## Implementation Approach

### Step 1: Update Stuck Record (Direct SQL Update)
Reset the stuck processing record via database migration to clear the lock.

### Step 2: Trigger Batch Retry (Edge Function)
Call the `batch-retry-transcriptions` edge function with:
```json
{
  "dryRun": false,
  "limit": 50,
  "specificBookingIds": null
}
```

This will:
- Scan for all bookings with `transcription_status IN ('failed', 'pending', null)` and valid `kixie_link`
- Identify the 30 failed + 1 newly reset stuck record
- Reset each to `pending`
- Trigger transcription with `skipTts = true` (batch cost optimization)
- Process in background with 30-second pacing

---

## Expected Outcomes

### Success Criteria
- ✅ Stuck record (Jose Ortiz) transitions from `processing` → `pending` → `completed`
- ✅ 30 failed records attempt retry and succeed or surface persistent errors
- ✅ Pipeline completes in ~15-20 minutes (background task)

### Result Breakdown
- **Best case**: All 31 records complete successfully
- **Realistic**: 
  - ~8-12 records with expired links remain `failed` (403 errors unrecoverable)
  - ~19-23 records succeed (transient errors resolved)
- **Action for expired**: Contact PadSplit to provide fresh Kixie links for failed 403 records

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Expired Kixie links (403) | Unrecoverable | Mark as permanent failures; request fresh links from PadSplit |
| Rate limiting on retry | Partial failure | 30-second pacing between requests (already built in) |
| AI quota exhaustion (402) | Possible | If quota errors persist, wait or upgrade ElevenLabs plan |
| Stuck record stays pending | Wasted effort | If no progress after 5 min, manual investigation via logs required |

---

## Files to Modify

### Database
- Create a migration to reset the stuck record status

### No Code Changes Needed
- The `batch-retry-transcriptions` edge function is already built and handles all retry logic
- We'll invoke it via a direct HTTP call post-migration

---

## Next Steps After Implementation

1. **Monitor backend logs**: Check `supabase--edge-function-logs` for `batch-retry-transcriptions` progress
2. **Verify completion**: Query `bookings` for transcription_status changes after 20 minutes
3. **Generate summary**: Count successful vs. failed retries and categorize failures
4. **Report to PadSplit**: Provide final count of completed records and list of unrecoverable 403 failures

