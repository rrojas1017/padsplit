

## Fix: Research Insights stuck in "Generating..." state

### What's happening

The report `a40f62b4-...` is stuck at `status: 'processing'` with all 4 chunks complete and phase `synthesizing`. The edge function was killed by the runtime before the synthesis completed (this run started *before* the timeout fallback fix was deployed). The UI keeps polling but the status never changes.

The staleness check in `checkExistingAnalysis` has a 30-minute window, which is too generous. The user has to wait up to 30 minutes before the system auto-recovers.

### Changes

**1. Reduce staleness timeout from 30 to 15 minutes**

**File: `src/hooks/useResearchInsightsPolling.ts`** -- line 103

Change `30 * 60 * 1000` to `15 * 60 * 1000`. No synthesis should take 15 minutes; if it does, the edge function is dead.

**2. Add a polling-side staleness check**

Currently the polling loop only checks `status === 'completed'` or `status === 'failed'`. It never detects a dead edge function. Add a check: if the `_progress` data hasn't changed across 3 consecutive polls (30 seconds of no progress), and the report is older than 10 minutes, mark it as failed and stop polling.

**File: `src/hooks/useResearchInsightsPolling.ts`** -- inside the polling interval callback

Track a `staleCount` ref. Each poll, compare `_progress` to the previous value. If identical, increment `staleCount`. If `staleCount >= 3` and report is >10 min old, update status to `failed` with message "Edge function terminated during synthesis" and call `onComplete()`.

**3. Show last completed report while generating**

The UI currently hides the completed report content when `isGenerating` is true (the page only shows the progress banner + empty area). Update `ResearchInsights.tsx` to continue displaying the last completed report beneath the progress banner, so users aren't staring at a blank page.

**File: `src/pages/research/ResearchInsights.tsx`** -- the conditional rendering block

Change the condition from `{!isLoading && selectedReport?.status === 'completed' && reportData && ...}` to also render when `isGenerating` is true and a completed report exists from the previous fetch.

### Summary
- `src/hooks/useResearchInsightsPolling.ts`: Reduce staleness window to 15 min + detect stalled progress during active polling
- `src/pages/research/ResearchInsights.tsx`: Show last completed report while new one is generating

