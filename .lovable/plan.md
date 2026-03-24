

## Retry 1,258 Records with 402 Errors

### What happened
These records completed STT transcription successfully but the downstream AI summarization step was rejected with HTTP 402 (quota exceeded) at the time of processing. The audio transcripts exist — only the AI analysis needs to be re-run.

### Execution approach

**Step 1: Invoke `batch-retry-transcriptions` with the 402-failed booking IDs**

Call the edge function with all 1,258 booking IDs using the `bookingIds` parameter. The function will:
- Delete existing `booking_transcriptions` records for each
- Reset `transcription_status` to `pending`
- Re-trigger `transcribe-call` for each record

**Pacing concern**: The function uses 30-second intervals between records. 1,258 records × 30s = ~10.5 hours of background processing.

**Step 2: Consider batching strategy**

To avoid a single 10-hour background task (which may hit edge function memory/timeout limits), split into batches of ~100 IDs per invocation, triggering multiple calls sequentially.

### Technical details

- Edge function: `batch-retry-transcriptions`
- Parameter: `{ bookingIds: [...], dryRun: false }`
- All 1,258 records are from 2026-03-23 (yesterday)
- The re-transcription will re-download audio and re-run both STT + AI summary

### Files to update
No code changes needed — this is a runtime operation using the existing edge function.

