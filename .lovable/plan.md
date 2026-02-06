

## Plan: Fix ElevenLabs TTS Generation for Uploaded Records

### Problem Identified

The `batch-retry-transcriptions` edge function is **NOT passing the `skipTts` flag** when calling `transcribe-call`. This causes ElevenLabs coaching audio (Jeff & Katty) to be generated for ALL records, including the 5,128 imported/uploaded records that should only receive transcription and QA scoring.

**Current behavior:**
```typescript
// batch-retry-transcriptions/index.ts (lines 131-134 and 299-302)
body: JSON.stringify({ 
  bookingId: booking.id, 
  kixieUrl: booking.kixie_link 
  // ❌ MISSING: skipTts flag!
}),
```

**Expected behavior (per bulk-transcription-processor):**
```typescript
// bulk-transcription-processor/index.ts (lines 218-223)
body: JSON.stringify({ 
  bookingId, 
  kixieUrl,
  skipTts: !includeTts || !isVixicom  // ✅ TTS only for Vixicom agents
}),
```

### Impact Assessment

- **367 records currently processing** → Generating unnecessary TTS audio
- Each record triggers 2 ElevenLabs TTS calls:
  - Jeff coaching audio (~$0.15 per 1000 characters)
  - Katty QA coaching audio (~$0.15 per 1000 characters)
- **Estimated unnecessary cost**: ~$50-100 for this batch alone

### Solution

Update `batch-retry-transcriptions` to:
1. Fetch agent site information for each booking
2. Pass `skipTts: true` for any booking that:
   - Has an `import_batch_id` (was uploaded/imported)
   - OR is not from a Vixicom site

### Technical Implementation

**File to modify:** `supabase/functions/batch-retry-transcriptions/index.ts`

**Changes required:**

1. **Update query to include site information** (for Vixicom check):
   ```typescript
   // Change from:
   .select('id, kixie_link, member_name, booking_date, transcription_status, transcription_error_message')
   
   // To:
   .select(`
     id, kixie_link, member_name, booking_date, transcription_status, transcription_error_message,
     import_batch_id,
     agents!inner(id, name, sites(name))
   `)
   ```

2. **Pass skipTts flag based on import status and site** (two locations):
   ```typescript
   // Determine if TTS should be skipped
   const isImported = !!booking.import_batch_id;
   const siteName = booking.agents?.sites?.name || '';
   const isVixicom = siteName.toLowerCase().includes('vixicom');
   const skipTts = isImported || !isVixicom;
   
   body: JSON.stringify({ 
     bookingId: booking.id, 
     kixieUrl: booking.kixie_link,
     skipTts
   }),
   ```

### Immediate Action for Currently Processing Records

Since 367 records are already being processed, some may have already triggered TTS generation. Once the fix is deployed:
- Future batch-retry runs will correctly skip TTS for imported records
- Records that already completed will have coaching audio generated (cannot be undone without deleting the audio files)

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/batch-retry-transcriptions/index.ts` | Add site query and skipTts logic |

### Verification

After deployment, verify:
1. Batch-retry correctly logs `skipTts: true` for imported records
2. New transcriptions for imported records don't have `coaching_audio_url` or `qa_coaching_audio_url` populated
3. Manual bookings from Vixicom still generate coaching audio as expected

