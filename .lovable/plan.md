

# Make Backfill Run in the Background (Survive Navigation)

## Problem
The backfill loop runs inside the React component's async function. When you navigate away, the component unmounts and the loop dies -- state updates are lost and no more batches fire.

## Solution
Move the orchestration to the backend using the same **self-retriggering** pattern already used by `bulk-transcription-processor`. The edge function processes one batch, then calls itself again via `fetch()` to continue. The frontend just kicks it off and polls a database row for progress.

## Changes

### 1. New Database Table: `lifestyle_backfill_jobs`

Create a table to track backfill progress:

```text
id              uuid (PK, default gen_random_uuid())
status          text ('running' | 'completed' | 'cancelled' | 'failed')
start_date      text (nullable)
end_date        text (nullable)
total_processed integer (default 0)
total_failed    integer (default 0)
remaining       integer (default 0)
started_at      timestamptz
completed_at    timestamptz (nullable)
created_by      uuid
created_at      timestamptz (default now())
```

RLS: Only super_admin users can read/write.

### 2. Edge Function (`batch-extract-lifestyle-signals/index.ts`)

Add self-retriggering logic after the existing batch processing:

- Accept a `jobId` parameter. If provided, update the job row with progress after each batch.
- If no `jobId`, create a new job row and set `jobId`.
- After processing a batch, check if `remaining > 0` and job status is still `'running'`.
- If yes, fire a `fetch()` to itself with `{ jobId, startDate, endDate, batchSize }` and the service role key (fire-and-forget), then return the current progress.
- If `remaining === 0` or job was cancelled, mark job as `'completed'` or `'cancelled'`.
- The first call returns immediately with the `jobId` so the frontend can start polling.

### 3. Frontend (`CrossSellOpportunitiesTab.tsx`)

Replace the `while` loop with a simpler flow:

- **Start**: Single `supabase.functions.invoke(...)` call that returns a `jobId`.
- **Poll**: `setInterval` every 3 seconds queries `lifestyle_backfill_jobs` for the job's progress (processed, remaining, status).
- **Display**: Progress bar updates from the polled data.
- **Cancel**: Update the job row's `status` to `'cancelled'`. The next self-retrigger checks this and stops.
- **Complete**: When polled status is `'completed'` or `'failed'`, stop polling and refresh data.

Because the loop state lives in the database and the edge function self-retriggers server-side, navigating away has zero effect. When the user returns to the tab, the polling resumes and shows current progress.

### 4. Resume on Mount

When the component mounts, query `lifestyle_backfill_jobs` for any row with `status = 'running'`. If found, resume polling that job's progress and show the progress bar automatically.

## Files Changed
- **New migration** -- create `lifestyle_backfill_jobs` table with RLS policies
- `supabase/functions/batch-extract-lifestyle-signals/index.ts` -- add job tracking and self-retrigger via `fetch()`
- `src/components/call-insights/CrossSellOpportunitiesTab.tsx` -- replace `while` loop with single invoke + polling interval + resume-on-mount logic

