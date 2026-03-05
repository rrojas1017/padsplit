

# Add Audio Playback to Reports Transcription Modal

## Problem
The audio player was added to the `CallDetailsModal` (Call Insights page), but the user is on the **Reports** page which uses a different component — `TranscriptionModal`. This modal has no inline audio player; it only uses the `kixieLink` URL to trigger transcription, never to play back audio.

## Change

### `src/components/booking/TranscriptionModal.tsx`
Add an inline `<audio>` player at the top of the transcription content area (after the status badges section, around line 491). The player will use `booking.kixieLink` as the audio source, since that field contains the direct recording URL.

- Add `Play` and `ExternalLink` icons to imports
- Insert a recording card with:
  - Native `<audio controls>` element with `preload="metadata"`
  - "Open in Kixie" external link button as fallback
- Show only when `booking.kixieLink` exists
- Place it between the status badges and the summary section so users see it immediately

The card will match the same pattern used in `CallDetailsModal`:
```text
┌─────────────────────────────────────────┐
│ 🔊 Call Recording                       │
│ ┌─────────────────────────────────────┐ │
│ │  ▶ ━━━━━━━━━━━━━━━━━  2:34 / 5:12  │ │
│ └─────────────────────────────────────┘ │
│              [Open in Kixie ↗]          │
└─────────────────────────────────────────┘
```

Also show the audio player in the "not yet transcribed" and "failed" states so users can listen even before/without transcription.

