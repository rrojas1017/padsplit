
# Fix Duplicate Cost Logging in transcribe-call

## Root Cause

The `check-auto-transcription` function has an atomic "claim" that sets `transcription_status = 'queued'` before proceeding, which correctly prevents duplicate transcriptions. However, there is a **silent bypass** at line 83-88: if a `42703` (schema cache) error occurs during the claim, the function logs a warning and **skips the claim entirely**, allowing both concurrent invocations to proceed to `transcribe-call` simultaneously.

This causes every service within `transcribe-call` to be logged twice:
- `stt_transcription` ×2 (biggest cost impact)
- `transcript_polishing` ×2
- `speaker_identification` ×2
- `ai_qa_scoring` ×2 (from `generate-qa-scores` called inside `transcribe-call`)

## Two Fixes Required

### Fix 1: Remove the 42703 bypass in `check-auto-transcription`

The current code at lines 83-88 has:
```
if (claimError.code === '42703') {
  // bypass the claim and proceed directly
}
```

This bypass is dangerous. The fix is to **always treat a claim error as a hard stop** — if we can't safely claim the booking, we do not proceed. The 42703 error was a one-time post-migration issue; it should not be a permanent bypass.

Change the error handling to return early on ANY claim error, including 42703. This is safe because if the claim truly fails, the booking will stay in `null` status and can be manually re-triggered.

### Fix 2: Add idempotency guard inside `transcribe-call` itself

Even with the claim fixed, `transcribe-call` should have its own second layer of protection. Before starting transcription, it should:

1. Check `transcription_status` of the booking
2. If status is already `processing` or `completed`, return early with a 409 Conflict

This gives defense in depth — even if a duplicate somehow gets through `check-auto-transcription`, `transcribe-call` itself will refuse to run twice.

## Files Changed

| File | Change |
|---|---|
| `supabase/functions/check-auto-transcription/index.ts` | Remove the 42703 bypass — treat all claim errors as hard stops |
| `supabase/functions/transcribe-call/index.ts` | Add idempotency check at entry: abort if `transcription_status` is already `processing` or `completed` |

## What This Fixes

- Eliminates the duplicate STT charges ($0.022-$0.111 wasted per call)
- Eliminates duplicate polish, speaker ID, and QA scoring charges
- Reduces per-booking cost from ~$0.124 back to the expected ~$0.047-0.070 (depending on call length)
- The 26-minute call outlier is normal variance — long calls legitimately cost more; the fix just stops counting them twice

## Note on Today's Duplicate Charges

The 3 bookings processed today have already been billed twice in `api_costs`. The actual Deepgram API was only called once (Deepgram billing is correct) — it's the **cost logging** that doubled, not the actual API spend. So today's real spend was ~$0.187 total across 3 bookings, not $0.373 as logged.
