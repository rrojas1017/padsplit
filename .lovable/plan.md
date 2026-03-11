

## Fix: Research Insights UI rendering empty cards

### Root Cause

The UI components are intact — design, colors, icons, priority badges are all unchanged. The problem is **data shape mismatch**. The latest completed report (`8f806a9f`) has malformed data from the synthesis/merge pipeline:

| Field | Expected | Actual |
|-------|----------|--------|
| `executive_summary` | `{ headline, total_cases, ... }` | Raw string |
| `operational_blind_spots` | `[{ blind_spot, description }]` | `["string", "string"]` |
| `host_accountability_flags` | `[{ flag, description, priority }]` | `["string", "string"]` |
| `emerging_patterns` | `[{ pattern, evidence, watch_or_act }]` | `["string", "string"]` |
| `reason_code_distribution` | `[{ code, count, pct }]` or `{ by_category }` | `{ "Payments": ..., "Host Issue": ... }` (key-value map with 60+ keys) |
| `issue_clusters` | Structured (OK) | Structured (OK) |
| `top_actions` | Structured (OK) | Structured (OK) |

The cards render but show **blank content** because the UI accesses `.blind_spot`, `.pattern`, `.flag` etc. which are `undefined` on plain strings.

### Fix: Two-layer defense

**1. Harden `normalizeChunkResult()` in the edge function** to normalize individual array items (not just check if the array exists):

- `operational_blind_spots`: if item is a string, wrap to `{ blind_spot: item }`
- `host_accountability_flags`: if item is a string, wrap to `{ flag: item }`
- `emerging_patterns`: if item is a string, wrap to `{ pattern: item }`
- `reason_code_distribution`: if it's an object (key-value map), convert to array format `[{ code: key, count: value, pct: 0 }]`
- `executive_summary`: already handled (string → object) but verify it runs before final save

**2. Add defensive normalization in the UI components** so they gracefully handle both formats even if the backend sends unexpected shapes. This prevents blank cards regardless of what the AI returns:

- `BlindSpotsPanel`: if item is string, treat as `{ blind_spot: item }`
- `HostAccountabilityPanel`: if item is string, treat as `{ flag: item }`
- `EmergingPatternsPanel`: if item is string, treat as `{ pattern: item }`
- `ReasonCodeChart`: if data is a plain object (not array, no `by_category`), convert keys to array format
- `ExecutiveSummary`: if data is string, wrap to `{ headline: data }`

**3. Re-normalize the existing broken report data** via a one-time database migration so the current report renders correctly without needing regeneration.

### Files to edit
- `supabase/functions/generate-research-insights/index.ts` — harden `normalizeChunkResult` item-level normalization
- `src/components/research-insights/BlindSpotsPanel.tsx` — defensive string-to-object
- `src/components/research-insights/HostAccountabilityPanel.tsx` — defensive string-to-object
- `src/components/research-insights/EmergingPatternsPanel.tsx` — defensive string-to-object
- `src/components/research-insights/ReasonCodeChart.tsx` — handle object-map format
- `src/components/research-insights/ExecutiveSummary.tsx` — handle string format
- Database migration: re-normalize report `8f806a9f`

