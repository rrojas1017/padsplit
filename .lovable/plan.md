

# Fix: PostgREST Schema Cache Blocking All Transcriptions

## Problem

All 6 bookings today have Kixie links but none were processed. The database trigger fires `check-auto-transcription` correctly, but the function fails at the atomic claim step with:

```
column bookings.transcription_status does not exist (error 42703)
```

This is a PostgREST schema cache issue — the API layer has a stale view of the `bookings` table and doesn't recognize `transcription_status`.

## Root Cause

The `check-auto-transcription` function uses the PostgREST client (`supabase.from('bookings').update(...)`) for the atomic claim. When PostgREST's schema cache is stale, this fails silently for every booking, blocking the entire transcription pipeline.

## Fix

Replace the PostgREST-based claim with a **raw SQL RPC call** that bypasses the schema cache entirely. This is the same pattern already used elsewhere in the codebase for reliability.

### Step 1: Create a database function for atomic claiming

Create an RPC function `claim_booking_for_transcription(p_booking_id uuid)` that:
- Updates `transcription_status` to `'queued'` only if it's currently NULL or `'failed'`
- Returns the booking ID if claimed, NULL if already claimed
- Uses raw SQL, completely bypassing PostgREST schema cache

```sql
CREATE OR REPLACE FUNCTION public.claim_booking_for_transcription(p_booking_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
BEGIN
  UPDATE bookings
  SET transcription_status = 'queued'
  WHERE id = p_booking_id
    AND (transcription_status IS NULL OR transcription_status = 'failed')
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;
```

### Step 2: Update `check-auto-transcription` edge function

Replace the PostgREST `.update()` call with `supabase.rpc('claim_booking_for_transcription', { p_booking_id: bookingId })`. This is a single-line change in the claim block.

### Step 3: Manually retrigger today's 6 stuck bookings

After deploying, call `batch-retry-transcriptions` to pick up the 6 bookings stuck with NULL status.

## Technical Details

| Item | Detail |
|---|---|
| Affected bookings | 6 (all from Feb 24) |
| Error code | 42703 (undefined column) |
| Root cause | PostgREST schema cache staleness |
| Fix approach | RPC function bypasses PostgREST entirely |
| Risk | None — RPC functions use direct SQL |

## Why This Keeps Happening

PostgREST caches the database schema and only refreshes periodically. When columns are added (like `transcription_status` was at some point), the cache can remain stale for extended periods. Using RPC functions for critical operations is the standard workaround — the function already has comments acknowledging this exact problem.

