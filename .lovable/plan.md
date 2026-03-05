

# Add Inline Audio Playback to Call Insights Modal

## What
Add an HTML5 audio player inside the `CallDetailsModal` so users can play back call recordings directly in the modal instead of only having an external Kixie link.

## Changes

### `src/components/call-insights/CallDetailsModal.tsx`
**Replace the external-link-only recording card** (lines 137-154) with an inline audio player + fallback external link:

- Add a native `<audio>` element with controls, styled to match the card
- Keep the "Open in Kixie" button as a secondary option below the player
- The `recording_url` from the `Call` object is a direct CDN URL that browsers can play natively via `<audio src={recording_url}>`

```text
┌─────────────────────────────────────────┐
│ 🔊 Call Recording                       │
│ ┌─────────────────────────────────────┐ │
│ │  ▶ ━━━━━━━━━━━━━━━━━  2:34 / 5:12  │ │  ← native <audio> controls
│ └─────────────────────────────────────┘ │
│                    [Open in Kixie ↗]    │  ← fallback link
└─────────────────────────────────────────┘
```

The recording card section will become:
- A `<Card>` with the `<audio controls>` element using the `recording_url` as source
- Full-width audio controls styled with Tailwind (`w-full rounded-lg`)
- The existing external link button stays as a secondary action

### No backend or schema changes needed
The `recording_url` field on the `calls` table already contains playable audio URLs.

