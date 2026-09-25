# CR-005 Corrective #2 — Re-trigger research AI processing on form-first finalize

## What changes for the business
When a ViciDial recording arrives before the web form is finalized, transcription runs first; a short call below the script minimum can be marked `has_valid_conversation=false`, so `process-research-record` is never called. Later the form finalizes, `mergeIntoBooking` flips `has_valid_conversation` to true and writes typed answers + `survey_progress` — but nothing re-triggers AI processing, so the record gets no AI extraction and is missing from the nightly per-script summary.

This change fires `process-research-record` from the CR-005 merge path in `submit-public-script` exactly when the booking is now valid and AI processing hasn't run (or previously failed). It never changes the form save response and never makes the save fail.

## Files
- `supabase/functions/submit-public-script/index.ts` — the only file changed. No SQL, no migration, no RLS, no `types.ts`, no other function, no frontend. No new dependencies.

## Placement: inside `finalizeSideEffects`, on the existing CR-005 merge path only
`mergeIntoBooking(targetId)` already runs in two linked (recording-created-the-booking) cases:
1. `existingBooking` branch (line ~433): `await mergeIntoBooking(existingBooking)`.
2. The `isBookingCallConflict` branch (lines ~465–471): re-reads the booking then `await mergeIntoBooking(bookingId)`.

Both are the "recording-first" case this fix targets. The new trigger runs at the end of `mergeIntoBooking` after a successful upsert. The new-booking insert path (lines ~445–486, transcription inserted directly) does NOT call `mergeIntoBooking`, so it is untouched — satisfying "not on the no-booking / new-booking paths".

## Edits

### 1. Declare `EdgeRuntime` (top of file, after the imports)
Same declaration transcribe-call uses:
```ts
declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void };
```
This is needed because submit-public-script does not currently reference it. At runtime it is a Supabase edge-runtime global.

### 2. Module-level helper: `triggerResearchProcessing(bookingId)`
A single-attempt POST using transcribe-call's exact `callDownstreamFunction` call shape (no retry, errors only logged):
```ts
async function triggerResearchProcessing(bookingId: string): Promise<void> {
  try {
    const res = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-research-record`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ bookingId }),
      },
    );
    if (!res.ok) {
      console.error(`[cr005] process-research-record HTTP ${res.status} for ${bookingId}`);
    }
  } catch (e) {
    console.error(`[cr005] process-research-record call failed for ${bookingId}`, e);
  }
}
```
No `failed_downstream_calls` logging, no retry — strictly single attempt, errors only logged, per the ticket.

### 3. Inside `finalizeSideEffects`, near `mergeIntoBooking`: `maybeTriggerResearchProcessing(targetId)`
Reads the four required signals in one `Promise.all` (two `maybeSingle` reads: bookings + booking_transcriptions), then decides. The reads are awaited so we have the values before deciding; only the downstream fetch is backgrounded.
```ts
const maybeTriggerResearchProcessing = async (targetId: string): Promise<void> => {
  let reason: string | null = null;
  try {
    const [bk, bt] = await Promise.all([
      admin.from('bookings')
        .select('transcription_status, has_valid_conversation')
        .eq('id', targetId).maybeSingle(),
      admin.from('booking_transcriptions')
        .select('research_processing_status, call_transcription')
        .eq('booking_id', targetId).maybeSingle(),
    ]);
    const tStatus = (bk.data as any)?.transcription_status ?? null;
    const hasValid = (bk.data as any)?.has_valid_conversation === true;
    const transcript = (bt.data as any)?.call_transcription;
    const rps = (bt.data as any)?.research_processing_status ?? null;
    const hasTranscript = typeof transcript === 'string' && transcript.trim() !== '';

    if (tStatus !== 'completed') {
      reason = `transcription_status=${tStatus ?? 'null'}`;
    } else if (!hasValid) {
      reason = 'has_valid_conversation=false';
    } else if (!hasTranscript) {
      reason = 'no transcription text';
    } else if (rps === 'processing' || rps === 'completed') {
      reason = `research_processing_status=${rps}`;
    } else {
      console.log(`[cr005] triggered process-research-record for ${targetId}`);
      const p = triggerResearchProcessing(targetId);
      if (typeof EdgeRuntime !== 'undefined' && typeof (EdgeRuntime as any)?.waitUntil === 'function') {
        (EdgeRuntime as any).waitUntil(p);
      } else {
        p.catch(() => {});
      }
      return;
    }
  } catch (e) {
    reason = 'read failed';
    console.error('[cr005] processing trigger read failed', e);
  }
  console.log(`[cr005] processing not triggered: ${reason}`);
};
```
Condition summary (all must hold to fire): `transcription_status = 'completed'`, `has_valid_conversation = true` (read back after the merge), `call_transcription` non-empty, and `research_processing_status IS NULL or = 'failed'`.
Not triggered when `research_processing_status` is `'processing'` or `'completed'` (process-research-record keeps typed answers via its generic `{...aiMap, ...existingMap}` merge), when transcription isn't completed yet (transcribe-call will call it itself), or when there's no transcript text.

### 4. Call site in `mergeIntoBooking`
The current tail of `mergeIntoBooking`:
```ts
const { error: mergeErr } = await admin
  .from('booking_transcriptions')
  .upsert({ ... }, { onConflict: 'booking_id' });
if (mergeErr) console.error('submit-public-script: linked merge failed', mergeErr.message);
```
Becomes:
```ts
const { error: mergeErr } = await admin
  .from('booking_transcriptions')
  .upsert({ ... }, { onConflict: 'booking_id' });
if (mergeErr) {
  console.error('submit-public-script: linked merge failed', mergeErr.message);
} else {
  await maybeTriggerResearchProcessing(targetId);
}
```
`mergeIntoBooking` is already guarded by `if (count > 0)` and wrapped in `try/catch`. With `count === 0` nothing merges and nothing triggers — correct, because the scenario requires typed answers. The call is awaited (its reads must complete to decide), but the downstream fetch is backgrounded via `waitUntil`, so the HTTP response of submit-public-script is never changed and never blocked by AI processing.

## What must NOT change
- The response shape (`ok(...)` / `linked` / status codes); the trigger is fire-and-forget and only logs.
- BUG-005 save model (submission_id, save_seq, terminal immutability, in_progress, 6 h expiry), BUG-006/007/008 behaviour, and the CR-005 merge rules (typed answers over AI, `survey_progress` = typed count, routing stamp only if NULL).
- Credential/token auth; any other function; the database; `types.ts`; the frontend. No new npm/Deno dependencies.

## Verification
1. `deno check supabase/functions/submit-public-script/index.ts` — expect clean (no new errors; none exist here today).
2. Deploy `submit-public-script` only.
3. Confirm an unsigned POST `{}` returns the same 4xx as before (today: `400` `{ error: 'token is required' }`) — proving auth/guard behaviour is unchanged.
4. No test surveys submitted (QA proves live).
