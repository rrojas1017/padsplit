

## Update `src/types/research-insights.ts` to strict schema

### Problem
The current types file uses loose/flexible interfaces with many optional variant field names (e.g., `blind_spot` OR `title`, `cluster_name` OR `name`, `watch_or_act` OR `status`). The user wants a clean, strict schema as their canonical reference.

### Compatibility concern
The existing components (BlindSpotsPanel, IssueClustersPanel, HostAccountabilityPanel, EmergingPatternsPanel) use **their own inline interfaces** — they do NOT import from the shared types file. So replacing the shared types file will NOT break them.

The only consumers of the shared types are:
1. **`ResearchInsights.tsx`** — imports `deriveKPIs` and `ResearchInsightData`
2. **`TopActionsTable.tsx`** — imports `TopAction` and `TopActionsGrouped`

### Changes needed

**1. `src/types/research-insights.ts`** — Replace entirely with the user's strict version. Key differences from current:
- Adds `ResearchInsightRow` envelope type
- `ExecutiveSummary`: drops legacy field aliases (`title`, `key_finding`, `total_cases`, `addressable_pct`, etc.)
- `ReasonCodeItem`: `code` and `percentage` required, drops `reason_group`/`category`/`pct` aliases
- `IssueCluster`: field names change (`name` not `cluster_name`, `codes` not sub-arrays, `action`/`owner` inline)
- `TopAction`: removes `TopActionsGrouped` type, `description`/`rationale`/`ownership`/`cases_affected` aliases dropped
- `BlindSpot`: `title` + `description` (not `blind_spot`)
- `HostAccountabilityFlag`: `issue` (not `flag`/`issue_pattern`)
- `EmergingPattern`: `status` enum (not `watch_or_act`)
- `ProcessingStats`: snake_case field names (`total_research_records` not `totalResearchRecords`)
- `deriveKPIs`: simplified, uses new field names

**2. `src/pages/research/ResearchInsights.tsx`** — Line 163: adapt the `deriveKPIs` call to map the hook's camelCase `processingStats` to the new snake_case `ProcessingStats`:
```ts
const mappedStats = {
  total_research_records: processingStats.totalResearchRecords,
  processed_records: processingStats.processedRecords,
  flagged_for_review: processingStats.humanReviewCount,
  pending_records: processingStats.pendingRecords,
  failed_records: 0,
};
const kpis = deriveKPIs(reportData, mappedStats);
```

**3. `src/components/research-insights/TopActionsTable.tsx`** — Remove the `TopActionsGrouped` import (no longer exported). Keep the runtime `flattenActions` logic that handles both grouped object and flat array formats by using inline type guards instead of the removed type. Change `row.ownership` fallback references since `ownership` no longer exists in the type (keep at runtime for backward compat with `as any`).

### What stays unchanged
All 10+ child components keep their own inline interfaces. The hook keeps its camelCase `ProcessingStats`. No backend changes.

