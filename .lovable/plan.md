

# URL-Based Deepgram Transcription - Fix SLOW_UPLOAD Timeouts

## Problem Analysis

Today's transcription failures for **Bryanna Strong** and **Linda East** failed with `SLOW_UPLOAD` errors from Deepgram. The root cause is the current audio processing flow:

**Current Flow (Double Transfer)**
1. Edge function downloads audio blob from Kixie CDN (~20MB WAV files)
2. Edge function re-uploads entire blob to Deepgram API
3. Large files cause upload timeouts in step 2

**Proposed Flow (Direct Fetch)**
1. Edge function validates the Kixie URL (content-type check)
2. Edge function sends URL to Deepgram in JSON body
3. Deepgram fetches audio directly from Kixie CDN

This eliminates the upload bottleneck entirely - Deepgram's infrastructure pulls directly from Kixie's CDN.

---

## Implementation Plan

### Step 1: Add URL-Based Deepgram Function

Create a new `transcribeWithDeepgramUrl()` function that sends the audio URL instead of the blob:

```typescript
async function transcribeWithDeepgramUrl(
  audioUrl: string,
  apiKey: string
): Promise<STTResult> {
  const startTime = Date.now();

  const response = await fetch(
    'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&diarize=true&language=en-US&punctuate=true',
    {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: audioUrl }),
    }
  );
  // ... same response parsing logic
}
```

### Step 2: Update Audio Validation Flow

Instead of downloading the full blob, perform a lightweight **HEAD request** to validate:
- The URL is reachable
- Content-Type is audio (not HTML/webpage)
- Optionally check Content-Length for file size logging

```typescript
// Lightweight validation instead of full download
const headResponse = await fetch(kixieUrl, { method: 'HEAD' });
const contentType = headResponse.headers.get('content-type');
const contentLength = headResponse.headers.get('content-length');

if (contentType?.includes('text/html')) {
  throw new Error('Invalid URL - webpage, not audio');
}
```

### Step 3: Update Processing Flow

Modify `processTranscription()` to:
1. Perform HEAD request validation
2. Skip blob download for Deepgram provider
3. Call new URL-based function
4. Keep blob download as fallback for ElevenLabs (if ever needed)

### Step 4: Keep ElevenLabs Blob Upload Path

Maintain the existing blob-upload path for ElevenLabs as a fallback. This ensures the system can switch providers if needed without code changes.

---

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/transcribe-call/index.ts` | Add `transcribeWithDeepgramUrl()`, update validation to use HEAD request, modify `processTranscription()` flow |

---

## Technical Details

**Deepgram URL-Based API Format:**
```bash
curl --request POST \
  --header 'Authorization: Token YOUR_API_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"url":"https://calls.kixie.com/xxx.wav"}' \
  --url 'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&diarize=true'
```

**Benefits:**
- Eliminates ~20MB upload from edge function to Deepgram
- Reduces edge function memory usage
- Removes the primary cause of SLOW_UPLOAD timeouts
- Faster processing since Deepgram fetches from Kixie's CDN directly

**Edge Cases Handled:**
- Invalid URLs (HTML pages) - detected via HEAD Content-Type check
- 404/403 errors - detected via HEAD status code
- ElevenLabs fallback - maintains existing blob upload path
- File size logging - extracted from Content-Length header

---

## Testing Plan

After implementation:
1. Retry the 2 failed transcriptions (Bryanna Strong, Linda East)
2. Monitor edge function logs for successful URL-based transcription
3. Verify no SLOW_UPLOAD errors occur
4. Confirm cost logging still captures audio duration correctly

