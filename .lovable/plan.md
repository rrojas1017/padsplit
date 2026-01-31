

# Quality Comparison: Deepgram vs ElevenLabs STT

## Current Findings

### Data Summary
Based on analysis of recent transcriptions:

| Provider | Avg Chars/Min | Confidence | Latency | Cost/Min |
|----------|---------------|------------|---------|----------|
| ElevenLabs | ~1,100 | 99.8% | 4.6s | $0.034 |
| Deepgram Nova-2 | ~600 | 99.7% | 11.8s | $0.0043 |

### Quality Differences

**ElevenLabs Strengths:**
- Proper capitalization and punctuation
- Audio event tagging (phone sounds, laughter, music)
- Better formatted transcripts for human reading
- More content captured per minute of audio

**Deepgram Strengths:**
- 87% lower cost
- Higher word count (but different counting method)
- Good diarization (speaker identification)
- Direct API upload (simpler integration)

### The "More Words" Mystery Explained
Deepgram's higher word count is misleading - it doesn't add punctuation, so "Hello, how are you?" becomes four separate words vs three. When measuring by characters per minute, ElevenLabs actually captures significantly more content.

---

## Implementation Plan: Side-by-Side Quality Comparison

### Step 1: Add Force Provider Override

Modify the transcribe-call function to accept an optional `forceProvider` parameter, allowing you to re-process any call with a specific provider.

```typescript
// In the request handler
const { bookingId, kixieUrl, forceProvider } = await req.json();

// In processTranscription
const selectedProvider = forceProvider || await selectSTTProvider(supabase);
```

### Step 2: Create Comparison Table

Add a new database table to store side-by-side results:

```sql
CREATE TABLE stt_quality_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id),
  kixie_link TEXT NOT NULL,
  elevenlabs_transcription TEXT,
  elevenlabs_word_count INTEGER,
  elevenlabs_char_count INTEGER,
  elevenlabs_latency_ms INTEGER,
  elevenlabs_confidence NUMERIC(4,3),
  deepgram_transcription TEXT,
  deepgram_word_count INTEGER,
  deepgram_char_count INTEGER,
  deepgram_latency_ms INTEGER,
  deepgram_confidence NUMERIC(4,3),
  call_duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Step 3: Create Comparison Edge Function

Build a dedicated function that transcribes the same audio with both providers simultaneously and stores results for comparison.

```typescript
// supabase/functions/compare-stt-providers/index.ts
serve(async (req) => {
  const { bookingId, kixieUrl } = await req.json();
  
  // Download audio once
  const audioBlob = await downloadAudio(kixieUrl);
  
  // Run both providers in parallel
  const [elevenlabsResult, deepgramResult] = await Promise.all([
    transcribeWithElevenLabs(audioBlob, elevenLabsApiKey),
    transcribeWithDeepgram(audioBlob, deepgramApiKey),
  ]);
  
  // Store comparison
  await supabase.from('stt_quality_comparisons').insert({
    booking_id: bookingId,
    kixie_link: kixieUrl,
    elevenlabs_transcription: elevenlabsResult.transcription,
    elevenlabs_word_count: elevenlabsResult.wordCount,
    elevenlabs_char_count: elevenlabsResult.transcription.length,
    elevenlabs_latency_ms: elevenlabsResult.latencyMs,
    deepgram_transcription: deepgramResult.transcription,
    deepgram_word_count: deepgramResult.wordCount,
    deepgram_char_count: deepgramResult.transcription.length,
    deepgram_latency_ms: deepgramResult.latencyMs,
    call_duration_seconds: Math.max(elevenlabsResult.durationSeconds, deepgramResult.durationSeconds),
  });
  
  return new Response(JSON.stringify({ success: true, comparison: {...} }));
});
```

### Step 4: Build Comparison UI

Add a comparison view in the AI Management or Settings page showing:
- Side-by-side transcription text
- Character/word count differences
- Latency comparison
- Cost savings calculation

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| Database migration | CREATE | Add `stt_quality_comparisons` table |
| `supabase/functions/compare-stt-providers/index.ts` | CREATE | New edge function for parallel comparison |
| `supabase/functions/transcribe-call/index.ts` | MODIFY | Add `forceProvider` parameter |
| `src/pages/Settings.tsx` or new page | MODIFY | Add comparison UI |

---

## Testing Approach

1. Select 5-10 calls of varying lengths (30s, 1min, 5min, 10min)
2. Run the comparison function on each
3. Review results in comparison table
4. Human evaluate transcript quality for:
   - Word accuracy (are names correct?)
   - Speaker identification accuracy
   - Content completeness
   - Readability

---

## Recommendation

Based on current data, **ElevenLabs provides higher quality transcripts** but at 8x the cost. Before switching fully to Deepgram:

1. Run 10 side-by-side comparisons
2. Have team members rate transcript quality
3. Determine if the quality difference impacts downstream AI analysis

If Deepgram quality is "good enough" for your coaching/feedback use case, the 87% cost savings is significant (~$1,485 saved per 5,000 calls).

