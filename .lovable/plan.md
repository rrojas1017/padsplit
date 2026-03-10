

## Fix: Edge function killed before completing chunked analysis

### Problem
`EdgeRuntime.waitUntil()` has a hard ~150-second background execution limit. Even with Gemini Flash (~10-15s per chunk), processing 6 chunks sequentially plus synthesis (7 AI calls total) takes ~90-120s best case, but with retries or slightly slower responses it exceeds the limit. The worker gets killed mid-processing, leaving the report stuck as "processing" forever.

Report `cb9f648c` is currently stuck — completed only chunk 1/6 before being killed.

### Solution: Self-chaining architecture

Convert the edge function from processing all chunks in one invocation to a **self-chaining** pattern where:

1. Each invocation processes **one chunk** (well within the time limit)
2. After completing a chunk, the function stores the partial result and **re-invokes itself** with a `resume` payload containing the insight ID and the next chunk index
3. Once all chunks are done, the final invocation runs synthesis and marks the report as completed

This is the same pattern used successfully by `batch-process-research-records`.

### Technical Changes

**File: `supabase/functions/generate-research-insights/index.ts`**

1. **Add a `resume` code path** to `Deno.serve`: Accept `{ resume: true, insightId, chunkIndex, totalChunks }` as an alternative to the initial generation payload. When resuming, load partial state from the DB instead of re-fetching all records.

2. **Store partial chunk results in the DB**: After each chunk completes, append the chunk result to a `_chunks` array inside the `data` JSONB column. This preserves progress across invocations.

3. **Self-invoke for the next chunk**: After storing a chunk result, call `fetch()` to invoke the same edge function with the `resume` payload. Use `EdgeRuntime.waitUntil()` for this self-call so the current invocation can return immediately.

4. **On final chunk**: Run synthesis (or `programmaticMerge` on timeout), store the final result, and mark as completed.

5. **Mark stuck report as failed**: Database update to clear `cb9f648c`.

### Pseudocode

```text
Deno.serve(req):
  if req.body.resume:
    // Load insight record, get stored _chunks array
    // Process chunk[chunkIndex] only
    // Append result to _chunks in DB
    // If chunkIndex < totalChunks - 1:
    //   self-invoke with chunkIndex + 1
    // Else:
    //   run synthesis on all _chunks
    //   mark completed
  else:
    // Existing: fetch records, create insight, compute chunks
    // Store chunk metadata (totalChunks, classifications) in data._meta
    // Process chunk 0 only
    // Self-invoke with chunkIndex = 1
```

### Data flow

```text
Invocation 1: Create record → process chunk 0 → store → self-invoke(chunk=1)
Invocation 2: Load record → process chunk 1 → store → self-invoke(chunk=2)
...
Invocation 6: Load record → process chunk 5 → store → synthesize → mark completed
```

### Files to edit
- `supabase/functions/generate-research-insights/index.ts` — restructure to self-chaining
- Database: mark `cb9f648c` as failed

