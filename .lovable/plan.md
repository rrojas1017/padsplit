

## Fix: Retry the remaining 402-failed records with proper batching

### Problem
The `batch-retry-transcriptions` function uses 30-second pacing between records, but edge functions have a ~150-second wall-clock timeout. This means each invocation only processes ~4-5 records before being killed, leaving most records unprocessed.

### Solution: Fire-and-forget pattern (no pacing inside the function)

Instead of sequential processing with 30s delays inside a single function call, change the approach:

1. **Modify `batch-retry-transcriptions`** to remove the 30-second internal pacing and instead fire off all transcription calls concurrently (or with minimal delay like 1-2 seconds), since `transcribe-call` is an independent function that handles its own processing.

2. **Invoke in small batches of 5-10 IDs** from the client/script side, with the pacing happening *between invocations* rather than inside the function.

### Changes

#### 1. Update `batch-retry-transcriptions` edge function
- Reduce the internal delay from 30 seconds to 2 seconds (just enough to avoid hammering the API)
- This allows ~50+ records per invocation instead of ~4-5

#### 2. Re-trigger the remaining failed records
- Query for all bookings still showing `transcription_error_message LIKE '%402%'` (currently 71)
- Also query for records that were reset but failed again during the retry attempt
- Invoke in batches of 30-40 IDs per call

### Files to update
- `supabase/functions/batch-retry-transcriptions/index.ts` (reduce pacing from 30s to 2s)

### Runtime action
- After deploying the updated function, re-invoke it with the remaining failed booking IDs

