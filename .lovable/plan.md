

# Fix: 7 Bookings Stuck in "pending" Status

## Problem

7 of today's 9 bookings are stuck showing processing icons because their `transcription_status` is `pending` — a status that no function will pick up:

- `check-auto-transcription` sets status to `queued` (via the new RPC)
- `transcribe-call` only claims bookings with status `queued`, `failed`, or `null`
- `batch-retry-transcriptions` sets status to `pending` before calling `transcribe-call`

**The mismatch**: `batch-retry-transcriptions` writes `pending`, but `transcribe-call` doesn't recognize `pending` as a claimable status. The call to `transcribe-call` then fails with "Already processing or completed".

## Fix (Two Parts)

### Part 1: Update `transcribe-call` to accept `pending` status

In the claim logic at line 2160, add `pending` to the accepted statuses:

```typescript
.in('transcription_status', ['queued', 'failed', 'pending'])
```

This is the correct fix because `pending` is a legitimate pre-processing state set by `batch-retry-transcriptions`.

### Part 2: Immediately unstick the 7 bookings

Reset the 7 stuck bookings from `pending` to `null` so the existing claim logic (which already handles `null`) can process them. Then retrigger via `batch-retry-transcriptions`.

Alternatively, after deploying Part 1, simply call `batch-retry-transcriptions` again — it will set them to `pending` and this time `transcribe-call` will accept that status.

## Files Changed

| File | Change |
|---|---|
| `supabase/functions/transcribe-call/index.ts` (line 2160) | Add `'pending'` to the `.in()` filter |

## Impact

- 7 stuck bookings will process immediately after retrigger
- Future `batch-retry-transcriptions` calls will work correctly
- No database migration needed

