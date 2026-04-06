

# Fix: Audio Playback for Vici Dial Research Recordings

## Problem
Research recordings from Vici Dial are stored in `kixie_link` as `recordings.vixicom.com` URLs. The transcription edge function fetches these server-side successfully (transcriptions complete fine). But the browser's `<audio>` element tries to load them directly — `recordings.vixicom.com` blocks cross-origin browser requests, so playback fails (shows 0:00 / 0:00).

## Solution
Create a proxy edge function that fetches the audio server-side and streams it back to the browser as a blob.

## Changes

| File | Change |
|------|--------|
| `supabase/functions/proxy-recording-audio/index.ts` | **New** — accepts `bookingId`, verifies authenticated user, fetches `kixie_link` from `bookings` table, fetches audio from Vixicom server-side, streams it back with `Content-Type: audio/mpeg` and CORS headers |
| `src/components/booking/TranscriptionModal.tsx` | Replace direct `src={booking.kixieLink}` with a proxied blob URL. On modal open, fetch audio through the proxy edge function, create a blob URL, set it as `<audio src>`. Show a small loading spinner while audio loads. |
| `src/components/call-insights/CallDetailsModal.tsx` | Same proxy pattern for the audio player in Call Insights |
| `supabase/config.toml` | Add `[functions.proxy-recording-audio]` with `verify_jwt = true` |

### Edge Function: `proxy-recording-audio`
- Accepts `bookingId` as query param
- Validates JWT (authenticated users only)
- Looks up `kixie_link` from `bookings` table using service role
- Fetches the audio from `recordings.vixicom.com` server-side
- Streams response back with `Content-Type: audio/mpeg`, CORS headers, and caching headers
- Returns 404 if no recording URL exists, 502 if upstream fetch fails

### Frontend Change (TranscriptionModal)
```text
Modal opens → kixieLink exists?
  → Yes → setState(audioLoading=true)
  → fetch via supabase.functions.invoke('proxy-recording-audio', { bookingId })
  → Create blob URL from response
  → Set <audio src={blobUrl}>
  → setState(audioLoading=false)
```

This approach avoids all CORS/network issues since blob URLs are local to the browser. The edge function runs in the same environment that already successfully fetches these URLs for transcription.

