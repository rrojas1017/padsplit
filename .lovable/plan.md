

## Make Issue Clusters Drill-Down & Improve Visual Clickability

### Current State
- **ReasonCodeChart**: Already has clickable drill-down via `onGroupClick` — works with `ReasonCodeDrillDown` sheet. Has subtle "Click to view records →" hint.
- **IssueClustersPanel**: No drill-down at all. Has `reason_codes_included` in the AI schema but no `booking_ids`, and no click handler.
- **Visual cues**: Both components lack strong visual affordance that they're clickable.

### Changes

**1. Update AI Prompt C schema** (`supabase/functions/generate-research-insights/index.ts`)
- Add `booking_ids: []` to the `issue_clusters` schema so the AI maps specific records to each cluster.

**2. Add drill-down to IssueClustersPanel** (`src/components/research-insights/IssueClustersPanel.tsx`)
- Add `onClusterClick` callback prop mirroring the ReasonCodeChart pattern.
- Add a "View X records →" button inside each expanded cluster card that triggers the drill-down.
- Pass `booking_ids` and `reason_codes_included` from cluster data to the callback.
- Update the `IssueCluster` interface to include `booking_ids?: string[]` and `reason_codes_included?: string[]`.

**3. Wire up in ResearchInsights.tsx** (`src/pages/research/ResearchInsights.tsx`)
- Pass `onClusterClick` to `IssueClustersPanel` that opens the same `ReasonCodeDrillDown` sheet, reusing the existing component.

**4. Improve visual clickability on both components**
- **ReasonCodeChart detail cards**: Add a subtle right-arrow icon (ExternalLink or ChevronRight), stronger hover effect (border color change), and a group-level hover ring.
- **IssueClustersPanel**: Add a dedicated "View records" button with an ExternalLink icon inside the expanded content. Keep the collapsible trigger as-is (it's for expand/collapse, not drill-down).
- Both get `group-hover` transitions and pointer cursor to signal interactivity.

### Technical Details
- Reuses the existing `ReasonCodeDrillDown` component for both reason codes and issue clusters — no new components needed.
- The fallback query strategy in `ReasonCodeDrillDown` already handles `reasonCodesIncluded`, so issue clusters with only `reason_codes_included` (no `booking_ids`) will still work for older reports.

