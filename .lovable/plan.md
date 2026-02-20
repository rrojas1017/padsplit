
# Force Deepgram + Skip QA Scoring for Research Records

## The Problem

When a researcher logs a call and it gets transcribed, the `transcribe-call` edge function currently:

1. **Picks an STT provider using A/B weights** — this could select ElevenLabs at $0.034/min instead of Deepgram at $0.0043/min. For a 20-minute research call, that's $0.68 vs $0.086 — nearly 8x more expensive.
2. **Auto-triggers QA scoring** at the end of every transcription, including research records. The QA rubric is a PadSplit sales call rubric (greeting, objection handling, booking attempt) — none of which applies to a survey call.
3. **Does not fetch `record_type`** from the booking, so it has no way to branch on whether this is a research record or a standard booking.

## The Fix — Two Changes to `transcribe-call/index.ts`

### Change 1: Fetch `record_type` from the booking

The booking query at line 1453 currently selects `call_type_id, agent_id, status, agents(site_id)`. We add `record_type` to that query so it is available for the rest of the function.

```typescript
// Before (line 1453)
.select('call_type_id, agent_id, status, agents(site_id)')

// After
.select('call_type_id, agent_id, status, record_type, agents(site_id)')
```

Then capture it:
```typescript
const recordType = bookingData?.record_type || null;
const isResearch = recordType === 'research';
```

### Change 2: Force Deepgram for research records (skip A/B selection)

Replace the single `selectSTTProvider()` call with a branch:

```typescript
// Before (line 1487)
const selectedProvider = await selectSTTProvider(supabase);

// After
const selectedProvider = isResearch
  ? 'deepgram'
  : await selectSTTProvider(supabase);

if (isResearch) {
  console.log('[Background] Research record — forcing Deepgram (ElevenLabs never used for research)');
}
```

This completely bypasses the A/B weight table for research records. Deepgram is always used, regardless of how the weights are configured.

### Change 3: Skip QA scoring for research records

At line 2002, the QA scoring trigger runs unconditionally. We wrap it with the `isResearch` flag:

```typescript
// Before
const qaResult = await callDownstreamFunction('generate-qa-scores');

// After
if (!isResearch) {
  const qaResult = await callDownstreamFunction('generate-qa-scores');
  if (!qaResult.success) {
    console.error(`[Background] QA scoring failed permanently for ${bookingId}: ${qaResult.error || qaResult.statusCode}`);
  }
} else {
  console.log('[Background] Research record — skipping QA scoring (not applicable for survey calls)');
}
```

## Files to Change

| File | Change |
|---|---|
| `supabase/functions/transcribe-call/index.ts` | 1) Add `record_type` to booking SELECT, 2) Force `deepgram` when `isResearch`, 3) Skip `generate-qa-scores` call when `isResearch` |

## Cost Impact

For a 10-minute research call:

| | Before | After |
|---|---|---|
| STT (if ElevenLabs selected by A/B) | $0.34 | $0.043 (always Deepgram) |
| QA Scoring | ~$0.0001 wasted | $0.00 (skipped) |
| **Saving per call (worst case)** | — | **~$0.30** |

With a team doing 20 research calls/day, this saves up to ~$6/day or ~$180/month purely from provider selection enforcement.

## No Other Files Needed

- `check-auto-transcription` does not need changing — it just triggers transcription and passes `skipTts: true` for non-Vixicom records (which research records already are).
- `generate-qa-scores` does not need changing — it simply won't be called for research records.
- No DB migration required — `record_type` already exists in the `bookings` table.
