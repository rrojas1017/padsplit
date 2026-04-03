

# STEP 16 — Fix Barriers Tab & Label Deduplication

## Changes

### 1. `src/utils/audienceSurveyInsights.ts` — Add `normalizeLabel()` + update `formatAggLabels()`
- Add `normalizeLabel(raw)` with the comprehensive synonym map (safety/security merge, singular/plural, free-text oddball values like "advertised as a home but was a hotel" → "Misleading Listing")
- `normalizeLabel` calls `formatLabel` as fallback for unknown values
- Update `formatAggLabels()` to use `normalizeLabel()` instead of `formatLabel()` — this ensures all aggregation results across every tab get normalized before display
- Update `generateBarrierInsight()` to prioritize "Nothing Was Confusing" percentage when it's the majority, and only mention top confusion point if > 5%

### 2. `src/hooks/useAudienceSurveyResponses.ts` — Normalize in aggregation functions
- Update `aggregateArray()`: call `normalizeLabel(item)` before counting
- Update `aggregateSingle()`: call `normalizeLabel(val)` before counting  
- Update `crossTab()`: call `normalizeLabel()` on both v1 and v2 before counting
- Import `normalizeLabel` from `audienceSurveyInsights`

This single change cascades across ALL tabs since every chart uses these aggregation functions. "Safety" + "Security" → "Safety & Security", "Quality Of The Rooms" + "Quality Of The Room" → "Quality of Rooms/Houses", etc.

### 3. `src/components/audience-survey/BarrierAnalysis.tsx` — Improve charts + mapping table
- Add red/green legend above butterfly chart
- Fix XAxis: `tickFormatter={(v) => Math.abs(v).toString()}`, add direction label "← Concerns / Interest Drivers →"
- Increase YAxis width to 180px, truncate labels at 22 chars
- Replace partial-match `BARRIER_MAP` with exact-match map keyed on normalized labels (e.g. `'Safety & Security'` → interest: `'Safety & Security Focus'`, recommendation: `'Lead with verified hosts...'`)
- Look up counteracting interest count from the actual `interests` prop instead of hardcoding

### 4. No changes needed to other tab components
`formatAggLabels()` already wraps all aggregation results before they reach `PlatformGapChart`, `MessagingMatrix`, `CreativeStrategy`, etc. Since `formatAggLabels` will now use `normalizeLabel`, duplicates merge automatically.

### Files
| File | Change |
|------|--------|
| `src/utils/audienceSurveyInsights.ts` | Add `normalizeLabel()`, update `formatAggLabels` to use it, fix `generateBarrierInsight` |
| `src/hooks/useAudienceSurveyResponses.ts` | Apply `normalizeLabel()` in `aggregateArray`, `aggregateSingle`, `crossTab` |
| `src/components/audience-survey/BarrierAnalysis.tsx` | Add legend, fix axes, replace barrier-to-benefit mapping with exact-match map |

