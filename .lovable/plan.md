

## Add Live Progress Visibility to Report Generation

### Problem
After clicking "Generate Report", the UI shows a generic "Generating research insights... This may take a few minutes." banner with no detail about what's happening — no record count, no chunk progress, no elapsed time. The edge function logs show it's working (107 records, 3 chunks) but the user has no visibility.

### Solution
Enhance both the backend and frontend to surface real-time progress during report generation.

### Implementation

#### 1. Edge function: write chunk progress to the database
In `supabase/functions/generate-research-insights/index.ts`, update the `research_insights` row's `data` column with a `_progress` field after each chunk completes:
- Before processing: set `data = { _progress: { totalChunks, completedChunks: 0, totalRecords, currentPhase: 'analyzing' } }`
- After each chunk: increment `completedChunks`
- During synthesis: set `currentPhase: 'synthesizing'`
- On completion: the existing logic already sets `status: 'completed'` and overwrites `data`

This reuses the existing `data` JSONB column — no schema changes needed.

#### 2. Polling hook: surface progress data
In `src/hooks/useResearchInsightsPolling.ts`, expand the polling query to also select `data, total_records_analyzed` and expose a `progress` state object:
```
{ totalChunks, completedChunks, totalRecords, currentPhase }
```

#### 3. UI: rich progress banner
In `src/pages/research/ResearchInsights.tsx`, replace the simple "Generating..." text with:
- Record count: "Analyzing 107 records..."
- Chunk progress bar: "Chunk 2 of 3 complete"
- Phase label: "Analyzing..." → "Synthesizing results..."
- Elapsed time counter (client-side, starts when generation begins)

### Files changed
- `supabase/functions/generate-research-insights/index.ts` — write `_progress` to `data` column during processing
- `src/hooks/useResearchInsightsPolling.ts` — expose progress state from polling
- `src/pages/research/ResearchInsights.tsx` — rich progress banner with progress bar, phase, elapsed time

