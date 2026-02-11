

# Prevent Stale Schema Cache From Blocking Transcriptions

## Problem
After database migrations, PostgREST's schema cache can become stale, causing the `check-auto-transcription` function to fail with `column bookings.transcription_status does not exist`. This blocked 2 records today (Lanston Lowe and Nicholas Jackson) -- both are now processing after manual intervention.

## Why It Happens
- Database triggers (`trigger_auto_transcription_on_insert/update`) call `check-auto-transcription` via `pg_net`
- `check-auto-transcription` performs an atomic claim: `UPDATE bookings SET transcription_status = 'queued' WHERE ...`
- After a migration, PostgREST may not recognize new/existing columns until its cache refreshes (can take minutes to hours)
- The claim fails, and the record stays stuck in `queued` forever with no retry

## Solution: Add Resilience to `check-auto-transcription`

### 1. Add retry-with-fallback in `check-auto-transcription`
If the atomic claim fails with error code `42703` (undefined column), skip the claim and call `transcribe-call` directly -- since the claim is just a deduplication guard, it's safe to proceed without it in this edge case.

**File:** `supabase/functions/check-auto-transcription/index.ts`
- After the claim query fails, check if `claimError.code === '42703'`
- If so, log a warning and proceed to call `transcribe-call` directly (the transcribe function has its own idempotency checks)
- This makes the pipeline self-healing: even with a stale cache, records will still get processed

### 2. Add a safety net: auto-retry stuck `queued` records
Add a check in the existing `batch-retry-transcriptions` function to also pick up records stuck in `queued` status for more than 10 minutes. This acts as a background sweep.

**File:** `supabase/functions/batch-retry-transcriptions/index.ts`
- Expand the query to include `transcription_status = 'queued' AND created_at < now() - interval '10 minutes'`
- These records get re-triggered through `transcribe-call` directly

## Files Changed
- **Edit:** `supabase/functions/check-auto-transcription/index.ts` -- fallback on schema cache errors
- **Edit:** `supabase/functions/batch-retry-transcriptions/index.ts` -- sweep stuck `queued` records
