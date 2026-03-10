

## Streamline: Auto-process pending records before generating report

### The distinction today
- **"Process All"** runs AI extraction+classification on each individual transcript (per-record step)
- **"Generate Report"** aggregates all *already-processed* records into the insight dashboard (cross-record step)

They're sequential, not redundant: you must Process first, then Generate. But exposing both buttons is confusing — the user shouldn't need to know about the pipeline internals.

### Proposed change

**Merge the workflow into a single "Generate Report" button** that:
1. Checks if there are pending (unprocessed) records
2. If yes → triggers `batch-process-research-records` first, polls until done, then auto-triggers `generate-research-insights`
3. If no pending records → triggers `generate-research-insights` directly

**Remove the standalone "Process All" button** from the main controls. Keep the processing stats banner (showing X/Y processed) as read-only info — users can see progress but don't need to manually trigger it.

### File changes

**`src/pages/research/ResearchInsights.tsx`**
- Remove the "Process All" button from the processing stats card
- Update `handleGenerate` to:
  1. Check `processingStats.pendingRecords > 0`
  2. If pending: call `triggerBackfill()`, poll `fetchProcessingStats` every 10s until `pendingRecords === 0`, then call `generateReport()`
  3. If none pending: call `generateReport()` directly
- Update the in-progress banner to show "Processing records..." phase before "Analyzing..." phase
- Add a phase state: `'processing' | 'analyzing' | null`

**`src/hooks/useResearchInsightsData.ts`**
- No changes needed — `triggerBackfill` and `generateReport` already exist as separate functions

### UX result
- One button: "Generate Report" — always produces an up-to-date report
- Processing stats banner still shows progress (informational only)
- The banner text updates: "Processing X records..." → "Analyzing patterns..." → "Synthesizing results..."

