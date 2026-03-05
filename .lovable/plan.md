

# Remove "Open in Kixie" Buttons

## Changes

Two files have an "Open in Kixie" button below the inline audio player. Remove only the button while keeping the audio player intact.

### 1. `src/components/booking/TranscriptionModal.tsx` (lines 383-388)
Delete the `<Button>` wrapping the "Open in Kixie" link. Keep the `<audio>` element and its surrounding card.

### 2. `src/components/call-insights/CallDetailsModal.tsx` (lines 150-155)
Same change — remove the "Open in Kixie" button, keep the audio player.

Both files retain the call recording card with the inline `<audio controls>` element for playback.

