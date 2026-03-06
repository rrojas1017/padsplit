

## Findings

### Report Status
- **Latest report `d331bff9`** is stuck in "processing" with empty data. The `EdgeRuntime.waitUntil` background task silently died — even with parallel chunks, the total processing time (3 parallel AI calls + 1 synthesis) exceeds the edge runtime's actual background execution limit (~150 seconds). The 4-minute timeout guard also didn't fire because the runtime killed the entire promise.
- **Previous report `b6787fa1`** actually completed successfully with rich narrative data (title, key_findings, top_recommendation covering all 105 records). This is the most recent valid report.

### Preventability Data Factors
- The `preventability_data_factors` field is **missing from all classification records**. The reprocessing ran before or without the updated `process-research-record` function, so records don't have the new data-driven fields yet.

### Plan: Fix Both Issues

#### 1. Mark stuck report as failed + load last valid report
Run a database update to mark `d331bff9` as failed. The UI will then fall back to showing `b6787fa1` (the completed one).

```sql
UPDATE research_insights 
SET status = 'failed', error_message = 'Background task dropped by runtime' 
WHERE id = 'd331bff9-281c-4c45-ae68-809ef8c27dcb';
```

#### 2. Fix the timeout architecture (generate-research-insights)
The root cause is that `EdgeRuntime.waitUntil` has a hard ~150s limit that can't be extended. The fix is to move from background processing to **synchronous processing** — the HTTP response waits for completion. The Deno edge function has a 300s request timeout, which is sufficient for parallel chunks.

**Changes to `supabase/functions/generate-research-insights/index.ts`:**
- Remove `EdgeRuntime.waitUntil` and the timeout race
- Process insights synchronously within the request handler
- Return the completed insight ID in the response
- The client already polls for status, so this is transparent

#### 3. Verify preventability data factors
Check the deployed `process-research-record` function to confirm the `fetchMemberHistory` code is present. If it is, a re-run of "Reprocess All" will populate the `preventability_data_factors` in classifications. The next generated report will then reflect data-driven scores.

### Files to Edit
- `supabase/functions/generate-research-insights/index.ts` — switch from background to synchronous processing
- Database: one-time update to unblock the stuck report

