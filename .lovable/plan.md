
# Fix Stuck Non-Booking Analysis & Add Robust Error Handling

## Root Cause Analysis

The analysis record `9ac9ac4a-ae15-4ec6-85a2-9416b786a9f4` created on Feb 5 is stuck in `processing` status with `total_calls_analyzed: 0`. This indicates:

1. **Silent Failure in Background Task**: The `EdgeRuntime.waitUntil(processAnalysis(...))` is running in the background, but something failed and the error wasn't properly saved to the database.
2. **Pagination Timeout**: The new pagination loop fetches 6 batches of 500 records each. With network latency, this could exceed the edge function timeout (~150-180 seconds).
3. **Poor Error Capture**: The catch block (lines 166-169) does update the database, but if the error happens after a successful update attempt (e.g., during the database update itself), it might not get captured.

## Implementation Plan

### Phase 1: Clear Stuck Record
Delete or reset the stuck analysis record so it doesn't block new analyses:
```sql
DELETE FROM non_booking_insights 
WHERE id = '9ac9ac4a-ae15-4ec6-85a2-9416b786a9f4' AND status = 'processing';
```

This allows the frontend to stop polling a dead record and run a fresh analysis.

### Phase 2: Add Timeout Protection & Better Logging

**Problem:** The pagination loop can take 30+ seconds for 6 batches, plus 15+ seconds for AI processing, leaving no margin for error.

**Solution:** Add per-batch timeout and better error logging:

1. **Add batch timeout check**: After each batch, log elapsed time and warn if approaching limits.
2. **Add checkpoint updates**: Update the database after every 2-3 batches with progress (e.g., "fetched 1500 records, processing...").
3. **Improve error messages**: Log the exact point of failure (which batch, which operation) so we can debug faster.

**Key changes to `processAnalysis`:**
- Start timer at function entry
- Log after each batch fetch: `[Checkpoint] Fetched 1500 of 2859 records (52% complete)...`
- Add elapsed time tracking to warn if approaching timeout
- Wrap AI call in try-catch with specific error logging
- Log before and after database update operations

### Phase 3: Add Retry Logic with Exponential Backoff

**Problem:** If a batch fetch fails (temporary network error), the entire analysis fails.

**Solution:** Add retry logic to `fetchBookingsInBatches`:
- Retry failed batches up to 2 times with 2-second delays
- Log retry attempts with batch number
- Only throw after all retries exhausted

### Phase 4: Add Frontend Safeguard

**Problem:** The polling hook checks `status = 'processing'` every 10 seconds and can poll indefinitely for stuck records.

**Solution:** Add a timeout to the polling hook:
- If a record stays in `processing` for >5 minutes, automatically stop polling
- Show a "Analysis taking longer than expected" message
- Provide a "Cancel Analysis" button that sets status to 'failed'

## Files to Modify

| File | Changes | Priority |
|------|---------|----------|
| Database (non_booking_insights) | Delete stuck record | Critical (manual query) |
| `supabase/functions/analyze-non-booking-insights/index.ts` | Add timeout tracking, checkpoint updates, batch retry logic, detailed error logging | Critical |
| `src/hooks/useNonBookingInsightsPolling.ts` | Add polling timeout (5 min max), auto-stop logic | Important |

## Technical Implementation

### In Edge Function:
```typescript
async function processAnalysis(...) {
  const startTime = Date.now();
  const functionTimeoutMs = 120000; // 2 minutes safety margin from 150s limit
  
  try {
    // Add timer check before each major operation
    const elapsedCheck = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed > functionTimeoutMs) {
        throw new Error(`Function timeout approaching (${elapsed}ms elapsed)`);
      }
    };
    
    // In fetchBookingsInBatches: log checkpoint after each batch
    console.log(`[Progress] Batch ${batchNum}: ${currentCount}/${totalCount} records (${percentComplete}%)`);
    elapsedCheck();
    
    // Wrap each major operation with try-catch and specific logging
    try {
      const raw = await fetchBookingsInBatches(...);
      await supabase.from('non_booking_insights').update({
        status: 'fetching_complete',
        total_calls_analyzed: raw.length
      }).eq('id', id);
    } catch (fetchErr) {
      throw new Error(`Failed to fetch bookings: ${fetchErr.message}`);
    }
    
    // Similar wrapping for AI call
    try {
      const res = await fetch('https://ai.gateway.lovable.dev/...');
      if (!res.ok) throw new Error(`AI service returned ${res.status}`);
      // ... rest of AI processing
    } catch (aiErr) {
      throw new Error(`Failed to analyze with AI: ${aiErr.message}`);
    }
    
  } catch (e) {
    // Detailed error logging
    const errorMsg = e instanceof Error ? e.message : 'Unknown error';
    console.error(`[ProcessAnalysis] FAILED: ${errorMsg}`);
    await supabase.from('non_booking_insights').update({ 
      status: 'failed', 
      error_message: errorMsg,
      total_calls_analyzed: 0 // Reset to 0 on failure for clarity
    }).eq('id', id);
  }
}
```

### In Polling Hook:
```typescript
export const useNonBookingInsightsPolling = ({ 
  onComplete, 
  pollingInterval = 10000,
  maxPollingDurationMs = 5 * 60 * 1000 // 5 minutes
}: UseNonBookingInsightsPollingProps) => {
  const pollingStartTimeRef = useRef<number | null>(null);
  
  const startPolling = useCallback((insightId: string) => {
    pollingStartTimeRef.current = Date.now();
    activeInsightIdRef.current = insightId;
    
    pollingRef.current = setInterval(async () => {
      // Check if polling has exceeded max duration
      if (Date.now() - pollingStartTimeRef.current! > maxPollingDurationMs) {
        stopPolling();
        toast.error('Analysis is taking too long. Please try again.');
        onComplete();
        return;
      }
      
      // ... existing polling logic
    }, pollingInterval);
  }, [onComplete, pollingInterval, stopPolling]);
};
```

## Expected Outcome

✅ Stuck record cleared manually (one-time operation)
✅ New analyses have detailed logging for every major step
✅ Function logs exactly where failures occur (batch fetch vs AI processing vs DB update)
✅ Batch-level retry logic prevents transient failures
✅ Frontend stops polling after 5 minutes instead of waiting indefinitely
✅ Better visibility into what's happening: Users see progress messages
✅ Next analysis run will succeed and show full 2,859+ records analyzed

## Timeline

- **Clear stuck record:** 1 minute (manual query)
- **Implement edge function improvements:** ~15 minutes
- **Implement polling timeout:** ~5 minutes
- **Testing & deployment:** ~5 minutes
- **Total:** ~25 minutes

## Validation Checklist

After implementation:
1. ✅ Verify stuck record is deleted from database
2. ✅ Run analysis again and monitor edge function logs for checkpoint messages
3. ✅ Verify final result shows 2,859+ calls analyzed (not stuck at 0)
4. ✅ Test polling timeout by manually keeping a record in 'processing' for 6+ minutes
5. ✅ Verify frontend shows timeout message and stops polling
