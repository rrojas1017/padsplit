

# Fix: Executive Brief .docx Uses AI-Hallucinated Counts Instead of Real Data

## Problem
The Word export shows "329 Total Cases" and broken percentages (1%, 0%, 0%) because `generate-executive-docx.ts` reads everything from `reportData.executive_summary` — which is AI-generated JSONB with hallucinated values. The UI was already fixed (Step earlier) to use `selectedReport.total_records_analyzed`, but the export was never updated.

## Root Cause
Line 142 of `generate-executive-docx.ts`:
```typescript
{ label: 'Total Cases', value: es.total_cases?.toString() || '—' },
```
This reads from the AI's `executive_summary.total_cases` (329) instead of the accurate DB column `total_records_analyzed` (599).

Same issue for all KPI percentages — they come from the AI summary which computed against 329.

## Fix

### 1. `src/utils/generate-executive-docx.ts`
- Add a new `totalRecordsOverride` parameter to `generateMoveOutDocx()`
- Use it for "Total Cases" instead of `es.total_cases`
- Pass it to the AI narrative replacement (find-and-replace "329" with real count in AI text)

### 2. `src/pages/research/ResearchInsights.tsx`
- Pass `selectedReport?.total_records_analyzed` as the override when calling `generateMoveOutDocx()`

### Changes

| File | Change |
|------|--------|
| `src/utils/generate-executive-docx.ts` | Add `totalRecords?: number` param; use it for Total Cases KPI; also use KPIs derived from `reportData` the same way the UI does (via `deriveKPIs()` or inline) instead of AI summary values |
| `src/pages/research/ResearchInsights.tsx` | Pass `selectedReport?.total_records_analyzed` to `generateMoveOutDocx()` |

