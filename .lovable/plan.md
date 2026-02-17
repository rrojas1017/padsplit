

## Fix Duplicate TTS Generation

### Problem
Both `generate-coaching-audio` (Jeff) and `generate-qa-coaching-audio` (Katty) edge functions will regenerate audio every time they're called, even if audio already exists. This caused ~$0.60 in wasted spend today from duplicate clicks.

### Solution
Add an early "already exists" check in both functions that returns the existing audio URL immediately, skipping the expensive LLM + TTS pipeline. Allow explicit regeneration via an `isRegenerate` flag.

### Changes

**1. `supabase/functions/generate-coaching-audio/index.ts`**
- Accept `isRegenerate` parameter from the request body (like the QA function already does)
- After fetching `booking_transcriptions`, check if `coaching_audio_url` already exists
- If it exists AND `isRegenerate` is false, return the existing URL immediately with a `skipped: true` flag
- If `isRegenerate` is true, proceed with regeneration as normal
- This prevents double-clicks from generating duplicate audio

**2. `supabase/functions/generate-qa-coaching-audio/index.ts`**
- Already accepts `isRegenerate` but doesn't use it as a guard
- Add the same early-exit check: if `qa_coaching_audio_url` exists and `isRegenerate` is false, return existing URL immediately

### What the guard looks like (both functions)

```text
// After fetching transcription data:
if (transcriptionData.coaching_audio_url && !isRegenerate) {
  console.log(`[Skip] Coaching audio already exists for booking ${bookingId}`);
  return Response({ success: true, audioUrl: existing_url, skipped: true });
}
```

### No UI changes needed
The UI already sends the request and handles the response -- it will work the same whether the audio was freshly generated or returned from the existing URL. The `triggered_by_user_id` tracking from the previous fix remains intact for all non-skipped generations.

### Cost impact
This eliminates all duplicate TTS spend from double-clicks or rapid re-requests, saving an estimated $0.30-0.60 per occurrence.
