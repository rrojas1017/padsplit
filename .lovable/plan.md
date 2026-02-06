
## Problem
The existing `batch-retry-transcriptions` job is currently generating ElevenLabs TTS audio (coaching and QA coaching) for all processed records, which is wasting money. The user wants to disable TTS audio generation for this batch job.

## Root Cause Analysis
The `batch-retry-transcriptions` function correctly passes `skipTts=true` to the `transcribe-call` function for imported and non-Vixicom records (lines 137 and 316). The `transcribe-call` function properly honors this flag:
- **Line 1858**: `if (!skipTts)` guards Jeff's coaching audio generation
- **Line 1877**: `if (!skipTts)` guards Katty's QA coaching audio generation

**However**, the user is saying the *entire existing batch* should NOT use audio. This means we need to change the logic so that `batch-retry-transcriptions` passes `skipTts=true` for ALL records, regardless of import status or site.

## Solution
Modify `supabase/functions/batch-retry-transcriptions/index.ts` to ALWAYS pass `skipTts=true` when calling `transcribe-call`, effectively disabling all ElevenLabs TTS audio generation for this batch job.

### Changes Required

**File**: `supabase/functions/batch-retry-transcriptions/index.ts`

**Change 1** - Line 137 (specific bookings path):
Replace:
```typescript
const skipTts = isImported || !isVixicom;
```
With:
```typescript
const skipTts = true; // Batch-retry jobs do NOT generate coaching audio
```

**Change 2** - Line 316 (failed bookings path):
Replace:
```typescript
const skipTts = isImported || !isVixicom;
```
With:
```typescript
const skipTts = true; // Batch-retry jobs do NOT generate coaching audio
```

This ensures that when `batch-retry-transcriptions` triggers the `transcribe-call` function, it unconditionally skips ElevenLabs TTS generation (both Jeff's coaching audio and Katty's QA coaching audio), saving ~73% of current batch processing costs.

## Impact
- **Cost Savings**: Eliminates TTS costs (~$4-5/hour at current rates) for this batch job
- **Functionality**: Records still get STT transcription and AI analysis (summaries, key points, scores) - only coaching audio is skipped
- **Duration**: Batch processing may complete slightly faster since TTS calls are eliminated
- **Scope**: Only affects THIS batch job - future manual booking transcriptions will still generate coaching audio for Vixicom records

## Estimated Time
~1 minute - changing 2 lines in one file
