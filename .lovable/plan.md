

# Fix Duplicate Transcription Processing

## Problem

The `transcribe-call` edge function has a race condition that allows the same booking to be processed twice, causing duplicate Deepgram charges.

The current flow has two layers of deduplication, but neither is fully race-safe at the entry point:

1. **Serve handler (line 2179-2191)**: Uses a SELECT to read `transcription_status`, then checks if it's `processing` or `completed`. Two near-simultaneous requests can both read `queued` and both pass this check.

2. **Background task (line 1421-1448)**: Has an atomic UPDATE claim, but includes a `claimBypassed` fallback for schema cache errors (42703) that weakens the guarantee.

## Root Cause

When a booking is created/updated, database triggers fire `check-auto-transcription`. If two triggers fire close together (e.g., INSERT + UPDATE on the same row, or webhook retry), both calls reach `transcribe-call` before either background task has atomically claimed the record.

## Solution

Replace the serve handler's SELECT-based check with an **atomic UPDATE...RETURNING** claim directly in the request handler, BEFORE the background task fires. This ensures only one request can ever start background processing.

### Changes

**File: `supabase/functions/transcribe-call/index.ts`**

Replace the idempotency guard section (lines 2175-2191) with an atomic claim:

```typescript
// === ATOMIC DEDUP CLAIM: only one invocation can proceed ===
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseCheck = createClient(supabaseUrl, supabaseServiceKey);

const { data: claimResult, error: claimError } = await supabaseCheck
  .from('bookings')
  .update({ 
    transcription_status: 'processing',
    transcription_error_message: null 
  })
  .eq('id', bookingId)
  .in('transcription_status', ['queued', 'failed'])
  .select('id')
  .maybeSingle();

// Also handle NULL status (new records)
let claimed = !!claimResult;
if (!claimed && !claimError) {
  const { data: nullClaim } = await supabaseCheck
    .from('bookings')
    .update({ 
      transcription_status: 'processing',
      transcription_error_message: null 
    })
    .eq('id', bookingId)
    .is('transcription_status', null)
    .select('id')
    .maybeSingle();
  claimed = !!nullClaim;
}

if (!claimed) {
  console.warn(`[transcribe-call] Dedup: booking ${bookingId} already claimed. Aborting.`);
  return new Response(
    JSON.stringify({ success: false, reason: 'Already processing or completed' }),
    { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

Then remove the redundant claim inside `processTranscription` (lines 1419-1448) since the claim already happened in the handler. The background task should just proceed directly, and if it fails, set status back to `failed`.

Additionally, remove the `claimBypassed` escape hatch from `processTranscription` -- this was a workaround for schema cache issues but it defeats the deduplication. If the claim fails due to 42703, the handler should return a 503 retry-later response rather than silently bypassing the guard.

### Summary of Changes

| What | Why |
|---|---|
| Move atomic claim from background task to serve handler | Blocks duplicates before any work starts |
| Remove `claimBypassed` escape hatch | Eliminates the bypass that allowed duplicates through |
| Use `UPDATE...WHERE status IN (null, queued, failed)` | Only one concurrent request can win the atomic update |
| Remove redundant claim in `processTranscription` | Claim already happened; avoids double-update |

### Impact

- Prevents duplicate Deepgram STT charges
- Prevents duplicate LLM analysis charges  
- No changes to the frontend or database schema
- The `check-auto-transcription` function's existing claim remains as a first-layer guard (unchanged)

