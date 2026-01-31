

# Update AI Polishing Prompt for Brand & Transcription Fixes

## Overview

Enhance the transcript polishing prompt to fix common Deepgram transcription errors, specifically:
- **Brand names**: "Plates", "Pads", "pads split" → "PadSplit"
- **Industry terms**: "pads lit", "pad slit" → "PadSplit"
- **Common mishears**: "gonna" is OK, but "mister" → "Mr."

## Current Issue

From the side-by-side comparisons, Deepgram frequently mishears "PadSplit" as:
- "Plates" (most common)
- "pads split"
- "Pads"
- "pads lit"

This causes downstream issues in coaching and analysis.

---

## Implementation

### Step 1: Update the Polishing Prompt

Modify lines 188-204 in `supabase/functions/transcribe-call/index.ts`:

**Current prompt:**
```
ONLY fix:
1. Capitalization (proper nouns, sentence starts, titles like Mr./Mrs.)
2. Punctuation (commas, periods, question marks)
3. Number formatting ($330 not "3.30", 10% not "10 percent")
4. Common transcription errors ("gonna" is OK, but "mister" → "Mr.")
```

**New prompt:**
```
ONLY fix:
1. Brand names (CRITICAL - these are commonly misheard):
   - "Plates", "plates", "pads", "Pads", "pads split", "pads lit", "pad slit" → "PadSplit"
   - "Kix", "kicks", "kicky" → "Kixie" (phone system)
   - "hub spot" → "HubSpot"
   
2. Capitalization (proper nouns, sentence starts, titles like Mr./Mrs.)

3. Punctuation (commas, periods, question marks)

4. Number formatting ($330 not "3.30", 10% not "10 percent")

5. Common transcription errors:
   - "mister" → "Mr."
   - "missus" → "Mrs."
   - "gonna" and "wanna" are OK to keep
```

---

## Technical Details

### File to Modify

| File | Changes |
|------|---------|
| `supabase/functions/transcribe-call/index.ts` | Update `polishTranscript()` prompt (lines 188-204) |

### Updated Function (lines 184-247)

```typescript
async function polishTranscript(
  rawTranscript: string,
  lovableApiKey: string
): Promise<{ polished: string; inputTokens: number; outputTokens: number }> {
  const prompt = `Polish this call transcript for readability. DO NOT change any words or meaning except for the specific corrections below.

CRITICAL BRAND/COMPANY NAME FIXES (always apply these):
- "Plates", "plates", "pads", "Pads", "pads split", "pads lit", "pad slit", "pad split" → "PadSplit"
- "Kix", "kicks", "kicky", "kix e", "kix ee" → "Kixie"
- "hub spot", "Hub Spot" → "HubSpot"

FORMATTING FIXES:
1. Capitalization (proper nouns, sentence starts, titles like Mr./Mrs.)
2. Punctuation (commas, periods, question marks)
3. Number formatting ($330 not "three thirty", 10% not "ten percent")
4. Title corrections ("mister" → "Mr.", "missus" → "Mrs.")

KEEP AS-IS:
- All speaker labels (Speaker 0:, Speaker 1:) exactly as-is
- Natural contractions like "gonna", "wanna", "gotta"
- All words not listed in corrections above

RAW TRANSCRIPT:
${rawTranscript}

Return ONLY the polished transcript, no explanation.`;
  // ... rest of function unchanged
}
```

---

## Why This Works

1. **Priority ordering**: Brand fixes are listed first as "CRITICAL" so the AI prioritizes them
2. **Multiple variants**: Lists all known mishearings of each brand name
3. **Explicit keep list**: Prevents AI from "fixing" natural speech patterns
4. **No semantic changes**: Only formatting and known brand corrections

---

## Expected Results

| Before (Deepgram raw) | After (AI polished) |
|----------------------|---------------------|
| "Thank you for calling plates." | "Thank you for calling PadSplit." |
| "I'm looking at the pads split website." | "I'm looking at the PadSplit website." |
| "Let me check that in hub spot." | "Let me check that in HubSpot." |
| "mister David Kelly" | "Mr. David Kelly" |

---

## Testing

After deployment:
1. Re-run a comparison on a Deepgram-transcribed call
2. Verify "PadSplit" appears correctly in the polished output
3. Check that other words weren't incorrectly changed

