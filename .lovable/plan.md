
# Fix: transcribe-call Also Blocked by Stale Schema Cache

## Problem
The `check-auto-transcription` fix we deployed correctly bypasses the `42703` error and calls `transcribe-call`. However, `transcribe-call` has its **own** claim query (line 1348-1357) that also references `transcription_status` -- and it hits the same stale cache error. At line 1359-1362, it logs the error and **returns early**, so the transcription never actually runs.

This is visible in the logs: every attempt shows "Claim error" with `42703` followed by silence -- no actual transcription work happens.

## Root Cause
PostgREST's schema cache remains stale across **all** edge function invocations (not just `check-auto-transcription`). The `NOTIFY pgrst, 'reload schema'` command sent earlier did not propagate to the edge function runtime's connection pool.

## Solution

### 1. Add the same `42703` bypass to `transcribe-call` (lines 1359-1363)
When the claim query fails with `42703`, bypass the claim and proceed with transcription instead of returning early. The transcription upsert to `booking_transcriptions` table (line 1777) uses a separate table that is NOT affected by the stale cache, so the actual work will succeed.

**File:** `supabase/functions/transcribe-call/index.ts`

Current code (lines 1359-1362):
```
if (claimError) {
  console.error(`[Background] Claim error for ${bookingId}:`, claimError);
  clearTimeout(timeoutId);
  return;
}
```

Change to:
```
if (claimError) {
  if (claimError.code === '42703') {
    console.warn(`[Background] Schema cache stale (42703) for ${bookingId}. Bypassing claim.`);
  } else {
    console.error(`[Background] Claim error for ${bookingId}:`, claimError);
    clearTimeout(timeoutId);
    return;
  }
}
```

### 2. Handle `42703` on status update writes (lines 1761-1773, 1308-1316)
The final "completed" update and error update also write to `transcription_status`. Add try/catch with `42703` tolerance so the transcription data still gets saved even if the status column update fails.

### 3. Re-trigger the two stuck bookings
After deploying, manually invoke `transcribe-call` for both stuck records to process them immediately.

## Files Changed
- **Edit:** `supabase/functions/transcribe-call/index.ts` -- add `42703` bypass in 3 locations (claim, completion update, error update)
