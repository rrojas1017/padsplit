

# Fix: Total Cases KPI Shows AI-Hallucinated Count Instead of Actual Record Count

## Problem
The "Total Cases" KPI shows **329** (or similar) instead of **609** because:
- The database correctly tracks `total_records_analyzed = 599` on the `research_insights` row
- But the AI writes `executive_summary.total_cases = 329` inside the JSONB — this is a hallucinated/approximate number
- `deriveKPIs()` in `src/types/research-insights.ts` reads `executive_summary.total_cases` first, trusting the AI over the database

All percentage KPIs (addressable %, host related %, etc.) are also computed by the AI relative to its hallucinated 329 denominator, so those percentages may be inaccurate too — but since they're ratios the AI computed from its analysis, they're roughly correct. The **count** is the main issue.

## Fix

### 1. `src/pages/research/ResearchInsights.tsx` — Override totalCases with DB value

After computing `baseKpis`, override `totalCases` with `selectedReport.total_records_analyzed` (the database column that stores the actual count of records fed to the AI):

```typescript
const kpis: ExtendedKPIs | null = baseKpis ? {
  ...baseKpis,
  totalCases: selectedReport?.total_records_analyzed || baseKpis.totalCases,
  // ... rest stays the same
} : null;
```

This is a 1-line change. The `total_records_analyzed` column is already fetched by the `useResearchInsightsData` hook and available on `selectedReport`.

### 2. `src/types/research-insights.ts` — Update `deriveKPIs()` fallback order (defensive)

Change the `totalCases` derivation to prefer `stats.processed_records` over `executive_summary.total_cases` as a secondary signal, since the AI number is unreliable:

```typescript
const totalCases = totalCasesRaw != null && totalCasesRaw > (stats?.processed_records ?? 0) * 0.8
  ? Math.round(totalCasesRaw)
  : (stats?.processed_records ?? totalCasesRaw ?? 0);
```

Actually, the simpler fix: just always prefer `stats.processed_records` when available, since that's the real count.

### Why This Happens
The AI processes records in 30-record chunks. When synthesizing, it sometimes counts only a subset or approximates. The `total_records_analyzed` DB column is set programmatically from `processedRecords.length` (line 1207 of the edge function), so it's always accurate.

### Files
| File | Change |
|------|--------|
| `src/pages/research/ResearchInsights.tsx` | Override `totalCases` with `selectedReport.total_records_analyzed` |
| `src/types/research-insights.ts` | Update `deriveKPIs()` to prefer `stats.processed_records` over AI's `total_cases` |

