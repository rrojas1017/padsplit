

## Fix: Mark Stuck Report + Investigate Root Cause

### Current State
- Report `a5e5e6e3` is **stuck in "processing"** — all 3 chunks completed but the synthesis step likely timed out (no "Successfully completed" log entry)
- Report `d331bff9` **completed successfully** — the synchronous fix worked for that run
- The UI is likely polling or showing the stuck report instead of the completed one

### Root Cause
The synchronous approach works when total processing fits within 300s. However, 3 parallel chunks (~110s) + synthesis (~90s) = ~200s, which is close to the limit. If synthesis takes longer (large payload), it can still time out. The function returns a timeout error to the HTTP client, but never updates the DB status to "failed" because the `catch` block in the request handler returns an HTTP error but doesn't update the `research_insights` record.

### Fix

**1. Database: Mark stuck report as failed**
```sql
UPDATE research_insights 
SET status = 'failed', error_message = 'HTTP timeout during synthesis' 
WHERE id = 'a5e5e6e3-4028-4fcd-a594-25018981d87e' AND status = 'processing';
```

**2. Code fix in `generate-research-insights/index.ts`**
Add a `catch` block in the main request handler that updates the insight status to `'failed'` when `processInsights` throws or the request times out. Currently, if the function times out, the insight row stays in "processing" forever because only `processInsights` internal catch handles errors — but an HTTP-level timeout kills the whole function before that runs.

Add after the `await processInsights(...)` call, in the outer `catch`:
```typescript
// In the catch block, check if we created an insight and mark it failed
if (insight?.id) {
  await supabase.from('research_insights')
    .update({ status: 'failed', error_message: errorMessage })
    .eq('id', insight.id);
}
```

This requires moving the `insight` variable declaration outside the try block so it's accessible in catch.

### Files to Edit
- `supabase/functions/generate-research-insights/index.ts` — add failsafe status update in the catch block
- Database: one-time update to unblock the stuck report

