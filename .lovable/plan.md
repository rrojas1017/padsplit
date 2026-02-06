
## Plan: Standardize Transcription Pipeline with Consistent TTS Logic

### Problem Summary
Three edge functions that trigger transcriptions are **NOT** passing the `skipTts` flag, causing ElevenLabs coaching audio to be generated for ALL records instead of only manually created Vixicom bookings.

### Entry Points Analysis

| Function | Purpose | Current Status |
|----------|---------|----------------|
| `bulk-transcription-processor` | Bulk job processing | ✅ Has skipTts logic |
| `batch-retry-transcriptions` | Retry failed transcriptions | ✅ Just fixed |
| `transcribe-call` | Core transcription engine | ✅ Handles skipTts correctly |
| `check-auto-transcription` | Database trigger handler | ❌ Missing skipTts |
| `fix-incomplete-bookings` | Recovery/pipeline fixer | ❌ Missing skipTts |
| `receive-kixie-webhook` | Kixie call webhook | ❌ Missing skipTts |

### Business Rules (Your Requirements)
1. **ALL records** (manual + uploaded) get the same transcription + QA pipeline
2. **ONLY manual records** should use ElevenLabs TTS for coaching audio
3. **Detection**: A record is "uploaded" if it has an `import_batch_id` value

### Solution

#### File 1: `check-auto-transcription/index.ts`
Update to:
1. Fetch `import_batch_id` from the booking
2. Pass `skipTts: true` when `import_batch_id` is not null

```typescript
// Add to booking select query:
import_batch_id

// Add before calling transcribe-call:
const skipTts = !!bookingData.import_batch_id;

// Pass in request body:
body: JSON.stringify({
  bookingId: bookingData.id,
  kixieUrl: bookingData.kixie_link,
  skipTts
})
```

#### File 2: `fix-incomplete-bookings/index.ts`
Update to:
1. Fetch `import_batch_id` in the booking query
2. Pass `skipTts: true` when `import_batch_id` is not null

```typescript
// Add to booking/query:
import_batch_id

// Add before calling transcribe-call:
const skipTts = !!booking.import_batch_id;

// Pass in request body:
body: JSON.stringify({ 
  bookingId: booking.booking_id, 
  kixieUrl: booking.kixie_link,
  skipTts
})
```

#### File 3: `receive-kixie-webhook/index.ts`
This function handles **real-time Kixie calls**, not imported records. These are always manually triggered calls, so:
- `skipTts: false` is correct (TTS should run for live calls)
- However, we should still respect site-based logic (Vixicom only)

For consistency, update to:
1. Check if the agent belongs to a Vixicom site
2. Pass `skipTts: true` if not Vixicom

```typescript
// Add site check logic:
const siteName = /* fetch from agent */;
const isVixicom = siteName?.toLowerCase().includes('vixicom');
const skipTts = !isVixicom;

// Pass in request body:
body: JSON.stringify({
  callId: newCall.id,
  kixieUrl: payload.recordingurl,
  skipTts
})
```

### Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/check-auto-transcription/index.ts` | Add import_batch_id to query, pass skipTts |
| `supabase/functions/fix-incomplete-bookings/index.ts` | Add import_batch_id to query, pass skipTts |
| `supabase/functions/receive-kixie-webhook/index.ts` | Add site check, pass skipTts based on Vixicom |

### Result After Changes
- **Uploaded records**: Transcription ✅, QA Scores ✅, Jeff Audio ❌, Katty Audio ❌
- **Manual Vixicom records**: Transcription ✅, QA Scores ✅, Jeff Audio ✅, Katty Audio ✅
- **Manual non-Vixicom records**: Transcription ✅, QA Scores ✅, Jeff Audio ❌, Katty Audio ❌

### Technical Details

The `transcribe-call` function already handles the `skipTts` flag correctly (lines 1857-1888):
- If `skipTts = false`: Generates Jeff audio → QA scores → Katty audio
- If `skipTts = true`: Skips Jeff audio → QA scores → Skips Katty audio

All we need to do is ensure every entry point passes the correct flag based on whether the record was imported (`import_batch_id IS NOT NULL`).
