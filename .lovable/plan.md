

## Fix Stuck Report + Prevent Future Timeouts

### Problem
The `generate-research-insights` function processes 105 records in 3 sequential chunks of 50, each requiring a 60-120s AI call to gemini-2.5-pro. With 4 total calls (3 chunks + 1 synthesis), the background task exceeds the ~2 minute `waitUntil` limit and silently dies, leaving the report stuck in "processing" forever.

### Immediate Fix
1. Mark the stuck report `b6787fa1` as failed so the UI unblocks
2. Update the function to prevent this from happening again

### Architecture Fix
Change the multi-chunk processing from **sequential** to **parallel**:

**Current flow** (fails at ~2 min):
```text
chunk1 (90s) → chunk2 (90s) → chunk3 (90s) → synthesis (60s) = ~330s total
```

**New flow** (fits in ~2.5 min):
```text
chunk1 ─┐
chunk2 ─┼─ parallel (~90s) → synthesis (60s) = ~150s total
chunk3 ─┘
```

Additionally, add a **global try/catch timeout** that marks the report as failed if processing exceeds 4 minutes, so reports never get permanently stuck.

### Changes

**File: `supabase/functions/generate-research-insights/index.ts`**
- In `processInsights()`, change the chunk `for` loop to `Promise.all()` so all chunks process in parallel
- Add a timeout wrapper (4 min) around the entire `processInsights` call that marks the report as "failed" if exceeded
- Add error handling so if any chunk fails to parse, the function continues with available results

**Database**: Run a one-time update to mark the stuck report as failed:
```sql
UPDATE research_insights SET status = 'failed', error_message = 'Timed out during processing' WHERE id = 'b6787fa1-0f45-4b35-ba1c-2607dfc9f561' AND status = 'processing';
```

### Result
After the fix, generating a report will process all chunks simultaneously, completing in ~2.5 minutes instead of ~5.5 minutes. The user can then click "Generate Report" again successfully.

