

# Why Only 609 Move-Out Surveys — Root Cause & Fix

## What's happening

You have **817 valid research conversations** total, but only **609 show results** in the Move-Out Insights dashboard. The gap is **162 records** (the remaining 46 are audience surveys).

These 162 records have:
- `transcription_status = 'completed'` (marked as done)
- `call_summary` populated (AI did analyze the audio)
- `call_transcription` = empty string (raw transcript text wasn't stored)
- Real call durations (120–676 seconds, avg 160s) — these are NOT voicemails

The processing pipeline filters on `call_transcription IS NOT NULL AND != ''`, so these 162 get excluded even though the AI already generated summaries for them.

## Root cause

The transcription service (Deepgram) processed the audio and the AI generated summaries, but the raw transcript text wasn't persisted — likely a bug in the `transcribe-call` edge function where the summary was saved but the transcript field was left empty.

## Two-part fix

### Part 1: Re-transcribe the 162 missing records
Use the existing `batch-retry-transcriptions` edge function to re-process these 162 records. Their `kixie_link` audio URLs are still valid. This will populate the `call_transcription` field, after which the normal processing pipeline will pick them up.

**Action:** Invoke the batch retry function targeting records where `transcription_status = 'completed'` but `call_transcription` is empty.

### Part 2: Prevent future occurrences
Review the `transcribe-call` edge function to ensure it always saves the raw transcript text alongside the summary. If Deepgram returns empty text, the status should be set to `failed` (not `completed`).

### Files

| File | Change |
|------|--------|
| `supabase/functions/transcribe-call/index.ts` | Add guard: if transcript text is empty after Deepgram returns, set status to `failed` instead of `completed` |
| `supabase/functions/batch-retry-transcriptions/index.ts` | May need to add a mode to target "completed but empty" records |

### Alternative quick option
If you'd rather not wait for re-transcription, we could update the processing pipeline to also extract insights from records that have `call_summary` (even without raw transcription). But re-transcribing is the better long-term fix since it gives the AI the full transcript to work with.

