

## Add Audio Player to Reason Code Drill-Down Records

### What
Add an inline audio player to each expanded record in the drill-down modal so admins can listen to the actual call recording directly.

### How

**File: `src/components/research-insights/ReasonCodeDrillDown.tsx`**

1. **Extend the data model** — add `recordingUrl` to `DrillDownRecord` interface.

2. **Fetch `kixie_link` from bookings** — update both query strategies to include `kixie_link` in the `bookings!inner(...)` select clause and map it to `recordingUrl`.

3. **Add audio player in the expanded section** — inside the `CollapsibleContent`, render a native HTML5 `<audio controls>` element when `recordingUrl` is available, styled consistently with the existing audio player pattern used in `CallDetailsModal` (full-width, compact `h-10`). Place it at the top of the expanded details, before "Root Cause".

4. **Add `Volume2` icon** — show a small speaker icon on the collapsed row (next to the date) when a recording is available, giving a visual hint before expanding.

### Scope
- Single file change: `src/components/research-insights/ReasonCodeDrillDown.tsx`
- No database or backend changes needed

