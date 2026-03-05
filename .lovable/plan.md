

# Remove Redundant Transcript Actions in Reports Table

## Problem
The research records view has two separate clickable elements that both do the exact same thing (open the TranscriptionModal):
1. The icon in the **Transcription** column (line 1064)
2. The "Transcript" button in the **Actions** column (line 1131)

This is confusing and redundant, as shown in the screenshot.

## Change

### `src/pages/Reports.tsx`
**Merge into a single action**: Keep the "Transcript" button in the **Actions** column (it's more discoverable with a label), and make the Transcription column show only a static status icon (no click handler). This way:

- **Transcription column**: Shows the status icon (completed/processing/failed/pending) as a read-only indicator — no `onClick`, no `cursor-pointer`, no hover effect
- **Actions column**: Keeps the "Transcript" button as the single entry point to the modal

This applies to the research rows section (lines ~1062-1143). The bookings rows section likely has a different layout and should be left as-is.

