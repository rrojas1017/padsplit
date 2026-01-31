

# Hybrid STT Pipeline: Deepgram + AI Polishing

## The Idea

Instead of choosing between:
- **ElevenLabs**: High quality (~$0.034/min) but expensive
- **Deepgram**: Cheap (~$0.0043/min) but lower formatting quality

You can have **both** by using a hybrid approach:
1. **Deepgram** for the actual speech recognition (87% cheaper)
2. **Gemini Flash** to polish the raw transcript (add punctuation, proper casing, format numbers)

### Cost Comparison (18.8 min David Keeling call)

| Approach | Cost | Quality |
|----------|------|---------|
| ElevenLabs Only | ~$0.64 | High (proper casing, punctuation, audio events) |
| Deepgram Only | ~$0.08 | Lower (literal text, no casing) |
| **Deepgram + AI Polish** | ~$0.12 | High (AI fixes formatting) |

**Result: ~81% cheaper than ElevenLabs with comparable quality!**

### How AI Polishing Works

Deepgram output:
```
mister David Kelly? Yes. How you doing? I'm doing great sir how are you doing? I'm doing good.
```

After AI polish:
```
Mr. David Kelly? Yes. How you doing? I'm doing great, sir. How are you doing? I'm doing good.
```

The AI would:
- Fix capitalization (mister → Mr., sir → sir with comma before)
- Add proper punctuation (commas, periods, question marks)
- Format numbers ($330 instead of "3.30 a week")
- Preserve speaker labels (Agent/Member)
- Keep the text meaning identical (no paraphrasing)

---

## Implementation Plan

### Step 1: Create AI Polishing Function

Add a new function to polish Deepgram transcripts before they're stored:

```typescript
async function polishTranscript(
  rawTranscript: string,
  lovableApiKey: string
): Promise<{ polished: string; inputTokens: number; outputTokens: number }> {
  const prompt = `Polish this call transcript for readability. DO NOT change any words or meaning.

ONLY fix:
1. Capitalization (proper nouns, sentence starts, titles like Mr./Mrs.)
2. Punctuation (commas, periods, question marks)
3. Number formatting ($330 not "3.30", 10% not "10 percent")
4. Common transcription errors ("gonna" is OK, but "mister" → "Mr.")

KEEP:
- All speaker labels (Agent:, Member:) exactly as-is
- All words and their order
- Natural speech patterns and contractions

RAW TRANSCRIPT:
${rawTranscript}

Return ONLY the polished transcript, no explanation.`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-lite', // Fast and cheap
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  // Extract and return polished text
}
```

### Step 2: Modify Transcription Pipeline

Update `transcribe-call/index.ts` to add polishing when using Deepgram:

```typescript
// After Deepgram transcription, before speaker identification
if (selectedProvider === 'deepgram') {
  console.log('[Background] Polishing Deepgram transcript with AI...');
  const polishResult = await polishTranscript(sttResult.transcription, lovableApiKey);
  sttResult.transcription = polishResult.polished;
  
  // Log the polishing cost
  logApiCost(supabase, {
    service_provider: 'lovable_ai',
    service_type: 'transcript_polishing',
    edge_function: 'transcribe-call',
    booking_id: bookingId,
    input_tokens: polishResult.inputTokens,
    output_tokens: polishResult.outputTokens,
    metadata: { model: 'google/gemini-2.5-flash-lite' }
  });
}
```

### Step 3: Add Toggle in Settings

Add an option in AI Management to enable/disable polishing:

```sql
ALTER TABLE stt_provider_settings 
ADD COLUMN enable_ai_polish BOOLEAN DEFAULT true;
```

### Step 4: Update Billing Calculations

Add the polishing cost estimate to track savings:

```typescript
export const PRICING = {
  // ... existing
  ai_polish_per_1k_tokens: 0.00005, // Flash-lite is very cheap
};
```

---

## Cost Analysis

For a typical 18.8 min call with ~15,000 characters:

| Component | ElevenLabs | Deepgram + Polish |
|-----------|------------|-------------------|
| STT | $0.64 | $0.08 |
| AI Polish | $0.00 | ~$0.04* |
| **Total** | **$0.64** | **~$0.12** |
| **Savings** | - | **81%** |

*Polish cost estimated at ~15K input + 15K output tokens using Flash-lite ($0.00005/1K)

### At Scale (5,000 calls/month)

| Approach | Monthly Cost |
|----------|--------------|
| ElevenLabs Only | ~$3,200 |
| Deepgram + Polish | ~$600 |
| **Annual Savings** | **~$31,200** |

---

## Technical Details

### Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/transcribe-call/index.ts` | Add `polishTranscript()` function and integrate into Deepgram flow |
| `src/utils/billingCalculations.ts` | Add polish pricing constant |
| Database migration | Add `enable_ai_polish` column to settings |

### Processing Flow (Updated)

```
Audio File
    ↓
[Deepgram STT] → Raw transcript (cheap, fast)
    ↓
[AI Polish] → Clean transcript (proper formatting)
    ↓
[Speaker ID] → Agent/Member labels
    ↓
[AI Analysis] → Summary, feedback, scores
    ↓
[Coaching Audio] → TTS with polished script
```

### Edge Cases

1. **Very long calls (30+ min)**: Split transcript into chunks for polishing to avoid token limits
2. **Non-English content**: Skip polishing if language detection shows non-English
3. **Already clean text**: If confidence is high and text looks formatted, skip polishing

---

## Quality Validation

Before full rollout, I recommend:

1. **Run 5-10 side-by-side comparisons** showing:
   - ElevenLabs original
   - Deepgram raw
   - Deepgram + AI polished

2. **Compare coaching quality** by generating coaching audio from both approaches and evaluating if the feedback is equally specific/useful

3. **Monitor for issues** like:
   - AI changing word meaning
   - Lost speaker attributions
   - Formatting inconsistencies

---

## Summary

This hybrid approach gives you:
- **81% cost reduction** vs ElevenLabs
- **Higher quality** than Deepgram alone
- **Same downstream analysis quality** (AI gets clean input)
- **Optional toggle** to disable if issues arise

The key insight: AI is very good at fixing formatting/punctuation (cheap task) but STT is expensive. By separating these concerns, you get the best of both worlds.

