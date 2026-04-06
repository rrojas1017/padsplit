

# Fix: Enable Transcript & Audio Playback for All Record Types

## Problem
The "Transcript" button in the Reports page only appears when a record has a `kixieLink`. Records that have completed transcriptions but no `kixieLink` (or where the recording URL is stored differently) can't be accessed. Users should be able to view transcripts and play call recordings for all record types — bookings, non-bookings, and research/survey calls.

## Solution
Two changes across two files:

| File | Change |
|------|--------|
| `src/pages/Reports.tsx` | **Research tab** (~line 1246): Show Transcript button when `kixieLink` exists OR `transcriptionStatus === 'completed'`. **Bookings tab** (~line 1519): Same — show the transcript icon when `kixieLink` exists OR `transcriptionStatus === 'completed'` |
| `src/components/booking/TranscriptionModal.tsx` | No change needed — the audio player already conditionally renders only when `kixieLink` exists, and the transcript/insights display works independently of the audio URL |

### Specific Changes in Reports.tsx

**Research rows** (line ~1246):
```
// Before: {booking.kixieLink && (
// After:  {(booking.kixieLink || booking.transcriptionStatus === 'completed') && (
```

**Bookings rows — transcript icon** (line ~1519):
```
// Before: {booking.kixieLink && (
// After:  {(booking.kixieLink || booking.transcriptionStatus === 'completed') && (
```

This ensures:
- Records with a `kixieLink` show the button AND the audio player (as today)
- Records with a completed transcription but no `kixieLink` show the button to view insights (no audio player, which is fine)
- The audio player in the modal remains gated by `kixieLink` existence, so it only appears when there's actually audio to play

