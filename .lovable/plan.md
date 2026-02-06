
## Plan: Process 367 Unprocessed Non-Booking Calls (March-December 2025)

### Problem Context
- **367 non-booking calls** from March-December 2025 have `transcription_status = NULL` but valid `kixie_link` URLs
- These records were imported on January 29, 2026, before the auto-trigger implementation
- The earlier batch-retry logic fix now catches these records, but they need to be queued for processing
- **Current metrics**: 2,889 transcribed + 367 unprocessed = 3,257 total non-bookings

### Solution: Use Batch Retry Function with Date Range Filter

The `batch-retry-transcriptions` edge function is designed to handle exactly this scenario. It:
- Supports filtering by date range (`dateFrom` and `dateTo`)
- Processes records with `NULL`, `failed`, or `pending` transcription status
- Automatically checks for existing transcription records to avoid duplicates
- Uses 30-second pacing to avoid rate limiting
- Returns immediately with a response, processing in the background via `EdgeRuntime.waitUntil()`

### Processing Strategy

**Call the batch-retry-transcriptions function with:**
```json
{
  "dateFrom": "2025-03-01",
  "dateTo": "2025-12-31",
  "limit": 367,
  "dryRun": false
}
```

**Expected Behavior:**
1. Function queries for bookings matching the date range with `NULL`/`failed`/`pending` status
2. Filters to only those WITHOUT existing transcription records
3. Returns immediately with queued count
4. Processes in background: 367 records × 30 seconds per record = **~183 minutes (~3 hours)**
5. Each record progresses through: Transcription → Jeff (coaching) → QA → Katty (QA coaching)

**Pacing Considerations:**
- 30-second intervals prevent rate limiting on:
  - Kixie audio fetch
  - Deepgram transcription
  - OpenAI analysis
  - ElevenLabs TTS (coaching audio)
- 3-hour timeline is acceptable for historical backlog processing

### Monitoring

After queuing, the system will:
1. Update `transcription_status` from `NULL` → `pending` → `completed`/`failed`
2. Generate `booking_transcriptions` records upon success
3. Log errors in `transcription_error_message` if failures occur
4. Update Communication Insights automatically as records complete

### Verification Steps

After processing completes (~3 hours):
1. Query remaining `NULL` status records in date range (should be 0)
2. Verify all 367 records have either `completed` or `failed` status
3. Confirm Communication Insights metrics update: 2,889 → 3,256 transcribed (367 - 1 for the expired link)
4. Check non-booking analysis includes the full dataset

### Files to Modify
None - this is a functional operation using the existing `batch-retry-transcriptions` edge function that was just fixed.

### Risk Assessment
- **Low Risk**: The function is proven and used successfully for February backlog (23 records)
- **Error Handling**: Expired/unavailable audio links will be marked `failed` with error messages
- **No Data Loss**: Existing completed transcriptions are not affected
- **Idempotent**: Safe to re-run if needed

