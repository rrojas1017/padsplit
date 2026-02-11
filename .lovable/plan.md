

# Fix: Two Bugs Blocking All Transcriptions

## Root Cause
The PostgREST schema cache is stale and does not recognize `bookings.transcription_status`. This breaks every query that references that column -- not just the claim UPDATEs, but also SELECT queries.

## Bug 1: `check-auto-transcription` SELECT fails silently
The initial booking fetch (line 34) includes `transcription_status` in the SELECT column list. When the cache is stale, this query itself fails with `42703`. The error is caught on line 46 as "Booking not found" and the function returns 404 without ever reaching the claim or the call to `transcribe-call`.

**This is why the 4 newest records (Deon Holt, Lamar Camp, Kareem Lumpkin, Tristan DiVergigelis) have `NULL` status** -- the trigger fired but `check-auto-transcription` died immediately.

**Fix:** Remove `transcription_status` from the SELECT column list (line 37). It is not used in any logic after the SELECT -- it was only referenced in the type definition. The claim step handles status checking separately.

## Bug 2: `transcribe-call` claim bypass still exits early
When the claim UPDATE fails with `42703`, the bypass lets execution continue past the error check. But `claimResult` is `null` (because the query failed), so line 1374's `if (!claimResult)` catches it and returns "already processing/completed, skipping duplicate."

**This is why Lanston Lowe and Nicholas Jackson show "already processing/completed, skipping duplicate" in the logs** despite never being processed.

**Fix:** Add a `claimBypassed` flag. When `42703` is detected, set it to `true`. Then modify line 1374 to skip the duplicate check when `claimBypassed` is `true`.

## Changes

### File 1: `supabase/functions/check-auto-transcription/index.ts`
- Remove `transcription_status` from the SELECT on line 37
- Remove `transcription_status` from the type definition on line 58
- Add a `42703` catch around the initial SELECT itself (lines 46-52): if `bookingError.code === '42703'`, re-query without `transcription_status`

### File 2: `supabase/functions/transcribe-call/index.ts`
- Add a `let claimBypassed = false;` variable before the claim block
- Set `claimBypassed = true` inside the `42703` bypass (line 1366)
- Change line 1374 from `if (!claimResult)` to `if (!claimResult && !claimBypassed)`

### Post-deploy: Re-trigger all 6 stuck records
After deploying both functions, manually invoke `transcribe-call` for all 6 booking IDs to process them immediately.

## Files Changed
- **Edit:** `supabase/functions/check-auto-transcription/index.ts` -- remove `transcription_status` from SELECT, add error handling
- **Edit:** `supabase/functions/transcribe-call/index.ts` -- fix claim bypass logic with `claimBypassed` flag

