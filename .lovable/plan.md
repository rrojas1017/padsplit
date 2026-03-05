

# Update "Successful Research Calls" to Require 2-Minute Minimum Duration

## Summary
Add a `call_duration_seconds >= 120` requirement alongside `has_valid_conversation = true` for research calls to be considered "successful" across all filtering points.

## Changes

### 1. Database Backfill (SQL Migration)
Flag existing research records under 2 minutes as invalid:
```sql
UPDATE bookings
SET has_valid_conversation = false
WHERE record_type = 'research'
  AND has_valid_conversation = true
  AND (call_duration_seconds IS NULL OR call_duration_seconds < 120);
```
This will drop the valid count from ~827 to ~84.

### 2. Edge Function: `supabase/functions/transcribe-call/index.ts`
Update `validateConversation` to raise the hard duration cutoff from 15s to 120s for research calls. Since the function doesn't currently know the record type, we'll either:
- Pass `recordType` into `validateConversation` and apply 120s cutoff for research, or
- Apply the 120s cutoff at the caller site where `has_valid_conversation` is set, after `validateConversation` returns

The cleaner approach: keep `validateConversation` generic (15s cutoff for all calls), and add a **post-validation override** where the bookings record is updated — if `record_type = 'research'` and `call_duration_seconds < 120`, force `has_valid_conversation = false`.

### 3. Reports Query: `src/hooks/useReportsData.ts` (line 230)
Update the existing filter from:
```
record_type.neq.research,has_valid_conversation.is.null,has_valid_conversation.eq.true
```
To also require `call_duration_seconds >= 120` for research records. The simplest approach: since the backfill already sets `has_valid_conversation = false` for short research calls, the existing filter will automatically exclude them. No query change needed if backfill + edge function are correct.

### Files Changed
- **Database migration** — backfill ~743 research records under 2 minutes to `has_valid_conversation = false`
- **`supabase/functions/transcribe-call/index.ts`** — add 120s minimum for research calls when setting `has_valid_conversation`

