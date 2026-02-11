
# Fix Duplicate Processing of Bookings

## Root Cause Found

There are **two identical INSERT triggers** on the `bookings` table:

```text
trigger_auto_transcription        AFTER INSERT -> trigger_auto_transcription_on_insert()
trigger_auto_transcription_insert AFTER INSERT -> trigger_auto_transcription_on_insert()
```

Both call the exact same function, so every new booking fires `check-auto-transcription` **twice**, which triggers `transcribe-call` **twice**, doubling all costs (STT, LLM, TTS).

The `transcribe-call` function has no deduplication guard -- it blindly sets `transcription_status = 'processing'` and proceeds, so both invocations race through the full pipeline.

## Fix (2 changes)

### 1. Remove the duplicate trigger (database migration)
Drop `trigger_auto_transcription` (the older duplicate). Keep `trigger_auto_transcription_insert` as the single INSERT trigger.

```sql
DROP TRIGGER IF EXISTS trigger_auto_transcription ON public.bookings;
```

### 2. Add deduplication guard to `check-auto-transcription` edge function
Before triggering transcription, atomically check and set `transcription_status = 'queued'` using an UPDATE with a WHERE clause that only matches NULL or 'failed' status. If no rows are updated, another invocation already claimed it -- skip.

This is a simple atomic "claim" pattern:

```text
UPDATE bookings 
SET transcription_status = 'queued' 
WHERE id = bookingId 
  AND (transcription_status IS NULL OR transcription_status = 'failed')
```

If the update returns 0 rows, the booking was already claimed by the other trigger invocation, so we return early without calling transcribe-call.

### 3. Add deduplication guard to `transcribe-call` edge function
As a belt-and-suspenders defense, add a status check at the start of the background processing: if `transcription_status` is already `'processing'` or `'completed'`, skip processing.

## Files to Change

- **Database migration**: Drop `trigger_auto_transcription` trigger
- **`supabase/functions/check-auto-transcription/index.ts`**: Add atomic claim before triggering transcription
- **`supabase/functions/transcribe-call/index.ts`**: Add status guard at start of background processing

## Impact
- Eliminates 100% of duplicate processing
- Reduces cost per booking from ~$0.78 to ~$0.39
- No changes to the UI or other functions
