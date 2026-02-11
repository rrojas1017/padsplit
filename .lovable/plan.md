

# Fix Stuck Cross-Sell Backfill Job and Add Stall Detection

## Root Cause
The `batch-extract-lifestyle-signals` edge function uses a self-retriggering pattern where each invocation processes a batch and then fires a `fetch()` to re-invoke itself. At some point the self-trigger failed silently (network issue, cold start timeout, etc.), but the job row in `lifestyle_backfill_jobs` was never updated -- it still says `status: running` with no function actually executing.

The frontend polls this row, sees "running" with 577/5360 processed (10%), and displays the progress bar indefinitely.

## Solution

### 1. Unstick the Current Job (Database)
Run a migration to mark the stale job as `failed` so the UI clears the progress bar and allows a fresh run:

```sql
UPDATE public.lifestyle_backfill_jobs
SET status = 'failed', completed_at = NOW()
WHERE status = 'running'
  AND started_at < NOW() - INTERVAL '10 minutes';
```

### 2. Add Stall Detection to Frontend (`CrossSellOpportunitiesTab.tsx`)
During polling, compare `total_processed` across consecutive polls. If it hasn't changed for 60+ seconds while status is still "running", automatically mark the job as stale and offer a "Restart" button.

Changes:
- Track `lastProcessedCount` and `lastProgressTime` in refs
- On each poll, if `total_processed` hasn't increased in 60 seconds, update the job to `failed` and stop polling
- Show a toast: "Backfill stalled -- you can restart it"

### 3. Add Retry on Self-Trigger Failure (`batch-extract-lifestyle-signals/index.ts`)
Make the self-retrigger more resilient by awaiting the fetch response and retrying once on failure. If both attempts fail, mark the job as `failed` rather than leaving it "running".

Changes at the self-retrigger section (around line 322-331):
```text
Current:  fire-and-forget fetch().catch(log)
Proposed: await fetch, retry once on failure, mark job failed if both fail
```

## Files Changed
- Database migration: mark stale running jobs as failed
- `src/components/call-insights/CrossSellOpportunitiesTab.tsx` -- stall detection in poll loop
- `supabase/functions/batch-extract-lifestyle-signals/index.ts` -- resilient self-retrigger with failure handling

