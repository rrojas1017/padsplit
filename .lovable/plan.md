

## Backfill `has_valid_conversation` for 103 Research Records

### Problem
103 research records have `has_valid_conversation = NULL` because they were transcribed before the conversation detection feature was added. They already have transcriptions, summaries, and durations — they just need the validation logic applied retroactively.

### Plan

#### 1. Create edge function `backfill-conversation-validation/index.ts`

A new edge function that:
- Queries all bookings where `record_type = 'research'` AND `has_valid_conversation IS NULL` AND `transcription_status = 'completed'`
- For each record, applies the same `validateConversation` logic from `transcribe-call` (voicemail keywords, no-conversation indicators, duration checks)
- Also applies the research-specific 120-second minimum duration rule
- Updates `has_valid_conversation` to `true` or `false` for each record
- Processes in batches to stay within edge function limits
- Returns a summary of how many were marked valid vs invalid

The validation logic will be copied from `transcribe-call/index.ts` lines 47-139 (the `validateConversation` function) plus the research 120s duration check.

It will join `bookings` with `booking_transcriptions` to get the transcription text and summary, and use `bookings.call_duration_seconds` for the duration check.

#### 2. Add config entry in `supabase/config.toml`
```toml
[functions.backfill-conversation-validation]
verify_jwt = false
```

#### 3. No UI changes needed
The function will be invoked once manually. After backfill, the 103 records will have proper `true`/`false` values and the Reports page filter will work correctly.

