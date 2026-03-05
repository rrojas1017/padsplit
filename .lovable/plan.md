

# Auto-Continue Batch Processing & Increase Batch Size

## Current State
The edge function already has self-retriggering logic (lines 120-135), but the batch size is only 5 and the frontend doesn't reflect ongoing progress during auto-continuation.

## Changes

### 1. Increase batch size to 20
**File**: `supabase/functions/batch-process-research-records/index.ts` (line 8)
- Change `BATCH_SIZE = 5` → `BATCH_SIZE = 20`

### 2. Frontend: Auto-refresh stats during processing
**File**: `src/hooks/useResearchInsightsData.ts` — `triggerBackfill` function
- After triggering the batch, start a polling interval that refreshes `processingStats` every 10 seconds until `pendingRecords === 0`

### 3. Frontend: Show live progress during backfill
**File**: `src/pages/research/ResearchInsights.tsx`
- When `isBackfilling` is true, show a progress indicator with the current processed/total count
- Auto-stop the backfill state when stats show 0 pending records

This ensures one click of "Process All" processes everything automatically without repeated manual clicks, with live progress updates on the dashboard.

