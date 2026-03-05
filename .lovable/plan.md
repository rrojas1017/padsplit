

# Fix: Research Calls Showing All Attempts Instead of Successful Calls

## Problem
The `validateConversation` function in the transcription pipeline is too lenient. Out of 1,084 research calls marked as `has_valid_conversation = true`, approximately **262** are actually voicemails, disconnected calls, or failed connections that slipped through because:

1. The keyword list misses common AI summary phrases like "voicemail," "extremely brief," "hung up," "disconnected," "no further conversation"
2. Short calls (<30s) are only flagged if they contain voicemail keywords in the *transcription* text, but not if the AI *summary* says it was a non-conversation
3. No duration-based hard cutoff — 6-13 second calls with no real exchange are still marked valid

## Two-Part Fix

### Part 1: Backfill existing records (database migration)
Run an UPDATE to re-flag the ~262 misclassified records based on their AI summary content:

```sql
UPDATE bookings b
SET has_valid_conversation = false
FROM booking_transcriptions bt
WHERE bt.booking_id = b.id
  AND b.record_type = 'research'
  AND b.has_valid_conversation = true
  AND (
    bt.call_summary ILIKE '%voicemail%'
    OR bt.call_summary ILIKE '%no further conversation%'
    OR bt.call_summary ILIKE '%no substantive%'
    OR bt.call_summary ILIKE '%extremely brief%'
    OR bt.call_summary ILIKE '%no interaction%'
    OR bt.call_summary ILIKE '%no real conversation%'
    OR bt.call_summary ILIKE '%cuts off%'
    OR bt.call_summary ILIKE '%cut off before%'
    OR bt.call_summary ILIKE '%no information was exchanged%'
    OR bt.call_summary ILIKE '%no meaningful%'
    OR bt.call_summary ILIKE '%incomplete%'
    OR bt.call_summary ILIKE '%wrong number%'
    OR bt.call_summary ILIKE '%hung up%'
    OR bt.call_summary ILIKE '%disconnected%'
    OR bt.call_summary ILIKE '%not a sales call%'
    OR bt.call_summary ILIKE '%automated voice%'
    OR bt.call_summary ILIKE '%no conversation%'
    OR bt.call_summary ILIKE '%answering machine%'
  );
```

This will drop the count from ~1,084 to ~822 successful research calls.

### Part 2: Improve the detection function for future calls
**File: `supabase/functions/transcribe-call/index.ts`** — Update the `validateConversation` function:

1. Add a hard duration cutoff: calls under 15 seconds are automatically invalid (no real conversation can happen in <15s)
2. Expand the `noConversationIndicators` list to include the missed phrases: "voicemail," "extremely brief," "no further conversation," "hung up," "disconnected," "wrong number," "answering machine," "automated voice," "cuts off," "cut off," "no information was exchanged," "incomplete"
3. Also check the summary for "voicemail" keyword (currently only checked in transcription for short calls)

### Files Changed
- Database migration — backfill ~262 misclassified records
- `supabase/functions/transcribe-call/index.ts` — strengthen `validateConversation` function

