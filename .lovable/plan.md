

# Fix: AI Polishing Being Discarded by Speaker Identification

## Root Cause Analysis

The polishing step is running successfully, but its corrections are being **completely discarded** by the speaker identification step that runs immediately after.

### Bug Location

**File:** `supabase/functions/transcribe-call/index.ts` (lines 1058-1131)

### The Problem Flow

```text
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: Deepgram transcribes audio                              │
│         sttResult.words = ["plates", "calling", "about"...]     │
│         transcription = "plates is calling about..."            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 2: AI Polishing (lines 1060-1091)                          │
│         transcription = "PadSplit is calling about..."  ✅      │
│         (Corrections applied successfully)                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 3: Speaker Identification (lines 1093-1131)                │
│         transcription = applyCorrectLabels(sttResult.words)  ❌ │
│         (Rebuilds from RAW words, discarding polish!)           │
│         Final: "plates is calling about..." ← POLISHING LOST!   │
└─────────────────────────────────────────────────────────────────┘
```

### Code Evidence

**Line 1064-1067** - Polishing works:
```typescript
if (polishResult.polished !== transcription) {
  transcription = polishResult.polished;  // ✅ "PadSplit" correctly set
```

**Line 1126** - Overwrites with raw words:
```typescript
transcription = applyCorrectLabels(sttResult.words, speakerMapping);  // ❌ Uses raw words!
```

The `applyCorrectLabels` function (lines 805-830) rebuilds the transcript by iterating through `word.text` from the original STT response, not the polished text.

---

## Solution

Move the polishing step to **after** speaker identification, so the brand corrections are applied to the final formatted transcript instead of being overwritten.

### Changes Required

**Reorder the processing pipeline:**

1. STT transcription (Deepgram/ElevenLabs)
2. Speaker identification with raw words → formatted transcript
3. AI polishing on the **final formatted transcript** ✅

### Implementation

**Lines 1058-1131** - Restructure the order:

```typescript
// Step 1: Apply speaker identification FIRST (for all providers)
if (sttResult.words && sttResult.words.length > 0) {
  const mins = Math.floor(callDurationSeconds / 60);
  const secs = callDurationSeconds % 60;
  console.log(`[Background] Call duration: ${callDurationSeconds} seconds (${mins}:${secs.toString().padStart(2, '0')})`);

  // Format raw transcript with generic speaker labels
  const rawTranscript = formatRawTranscript(sttResult.words);
  
  // Use AI to identify which speaker is Agent vs Member
  const speakerMapping = await identifySpeakers(rawTranscript, lovableApiKey!);
  
  // Log cost for speaker identification
  logApiCost(supabase, {
    service_provider: 'lovable_ai',
    service_type: 'speaker_identification',
    edge_function: 'transcribe-call',
    booking_id: bookingId,
    agent_id: agentId || undefined,
    site_id: siteId || undefined,
    input_tokens: Math.ceil(3000 / 4),
    output_tokens: Math.ceil(150 / 4),
    metadata: { 
      model: 'google/gemini-2.5-flash-lite', 
      confidence: speakerMapping.confidence,
      speaker_0: speakerMapping.speaker_0,
      speaker_1: speakerMapping.speaker_1
    }
  });
  
  // Apply correct labels based on AI identification
  transcription = applyCorrectLabels(sttResult.words, speakerMapping);
  
  if (speakerMapping.confidence === 'fallback') {
    console.log('[Background] Warning: Speaker identification failed, using fallback assumption');
  }
}

// Step 2: Apply AI polishing AFTER speaker identification (for Deepgram only)
let polishApplied = false;
if (selectedProvider === 'deepgram') {
  const polishEnabled = await isAIPolishEnabled(supabase);
  if (polishEnabled && transcription.length > 0) {
    console.log('[Background] Polishing Deepgram transcript with AI...');
    const originalLength = transcription.length;
    const polishResult = await polishTranscript(transcription, lovableApiKey!);
    
    if (polishResult.polished !== transcription) {
      transcription = polishResult.polished;
      polishApplied = true;
      
      // Log the polishing cost
      logApiCost(supabase, {
        service_provider: 'lovable_ai',
        service_type: 'transcript_polishing',
        edge_function: 'transcribe-call',
        booking_id: bookingId,
        agent_id: agentId || undefined,
        site_id: siteId || undefined,
        input_tokens: polishResult.inputTokens,
        output_tokens: polishResult.outputTokens,
        metadata: { 
          model: 'google/gemini-2.5-flash-lite',
          original_length: originalLength,
          polished_length: polishResult.polished.length
        }
      });
      
      console.log(`[Background] Transcript polished successfully`);
    }
  } else {
    console.log('[Background] AI polishing disabled or empty transcript, skipping');
  }
}

console.log(`[Background] ${selectedProvider} transcription formatted, length:`, transcription.length);
```

---

## Summary

| Item | Details |
|------|---------|
| File | `supabase/functions/transcribe-call/index.ts` |
| Bug | Polishing applied at line 1064, then overwritten at line 1126 |
| Fix | Swap order: speaker identification first, then polishing |
| Impact | All 21 PadSplit variants will now be correctly applied |
| Testing | Deploy and trigger a test Deepgram transcription to verify |

This fix ensures the brand correction dictionary is applied to the final transcript that gets saved to the database, rather than being discarded by the speaker labeling step.

