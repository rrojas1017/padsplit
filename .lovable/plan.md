

## Fix 6 Post-Redesign Bugs — Single Pass

### Bug 1: Dashboard tab content verification + data debugging

The tab routing code (lines 374-418) is actually correct — Dashboard has ExecutiveSummary + TopActionsTable, Operations has HostAccountabilityPanel. The likely issue is the `executive_summary` JSONB blob using field names the component doesn't expect. 

**Fix**: Add a temporary `console.log` in ResearchInsights.tsx right after line 162 to dump `reportData` keys and the executive_summary object. Also, the ExecutiveSummary component expects `headline`/`key_findings` as strings (not arrays), while the strict type defines `key_findings: string[]`. The `as any` cast on line 376 hides this. No code change needed for routing — it's correct.

### Bug 2: KPI row shows 0% / dash

`deriveKPIs` relies on `executive_summary.preventable_percent` and `executive_summary.avg_preventability` — fields the AI report may not populate. Also computes `addressableCount` from `reason_code_distribution[].addressability` which may use different values.

**Fix**: Make `deriveKPIs` more resilient — try multiple field name variants (`preventable_percent`, `addressable_pct`, `preventable_pct`), and for `avgPreventability` also check `avg_preventability_score`. Add fallback computation from reason codes when executive_summary fields are missing.

### Bug 3: EmergingPatternsPanel — add maxVisible

**File**: `src/components/research-insights/EmergingPatternsPanel.tsx`
- Add `maxVisible?: number` prop (default: show all for backward compat)
- Add `useState` for `showAll` toggle
- Slice `data` to `maxVisible` when not expanded
- Add "Show all N patterns" button

**In ResearchInsights.tsx line 394**: Pass `maxVisible={5}`.

### Bug 4: BlindSpotsPanel — add maxVisible

**File**: `src/components/research-insights/BlindSpotsPanel.tsx`
- Same pattern: `maxVisible?: number` prop, `useState` toggle, slice + "Show all" button

**In ResearchInsights.tsx line 397**: Pass `maxVisible={5}`.

### Bug 5: HostAccountabilityPanel — add maxVisible

**File**: `src/components/research-insights/HostAccountabilityPanel.tsx`  
- Add `maxVisible?: number` prop with default behavior (show all when not set)
- Add "Show all N flags" toggle
- The component already handles both string and object formats correctly (line 45)

**In ResearchInsights.tsx line 403**: Pass `maxVisible={8}`.

### Bug 6: HumanReviewQueue pagination

**File**: `src/components/research-insights/HumanReviewQueue.tsx`
- Add `visibleCount` state starting at 20
- Slice `items` to `visibleCount`
- Add "Show more (N remaining)" button

**ProcessedRecordsList.tsx** already has a 10-item cap with "Show All" toggle (line 61/76-79), so it only needs the default page size reduced or kept as-is. No change needed.

### Files modified (6 files)

| File | Change |
|---|---|
| `src/types/research-insights.ts` | Make `deriveKPIs` handle field name variants |
| `src/pages/research/ResearchInsights.tsx` | Pass `maxVisible` props; add data debug log |
| `src/components/research-insights/EmergingPatternsPanel.tsx` | Add `maxVisible` prop + toggle |
| `src/components/research-insights/BlindSpotsPanel.tsx` | Add `maxVisible` prop + toggle |
| `src/components/research-insights/HostAccountabilityPanel.tsx` | Add `maxVisible` prop + toggle |
| `src/components/research-insights/HumanReviewQueue.tsx` | Add 20-item pagination |

No backend changes. No new files.

