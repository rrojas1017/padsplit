

## Why Research Processing Is Slow — Analysis & Fix

### Root Cause

There are **three compounding bottlenecks**:

1. **Sequential processing with long AI calls**: Each record requires 2 Gemini 2.5 Pro calls (~20-30 seconds each), plus a hardcoded **2-second delay** between records. That's ~60 seconds per record.

2. **Only 79 eligible records remain** (out of 103 valid conversations, 23 already done). The other 1,714 research records are `has_valid_conversation = false` (voicemails/brief calls) — they are correctly excluded. So the total pool is manageable.

3. **The batch stalls and stops self-retriggering**. Edge functions have a ~60-second wall-clock timeout. With 20 records × ~60s each, the function times out long before finishing the batch. Only 1-3 records complete per batch invocation before the function is killed.

### Proposed Fix

**A. Reduce batch size to match reality** — Set `BATCH_SIZE = 5` since only ~3 records complete before timeout anyway. This ensures clean self-retriggering without silent deaths.

**B. Process records in parallel (3 at a time)** — Instead of sequential `for` loop with `await`, use `Promise.allSettled()` to process 3 records concurrently. This cuts time from ~60s/record to ~20s/batch-of-3.

**C. Remove the 2-second inter-record delay** — The Lovable AI gateway handles rate limiting; the artificial delay wastes time.

**D. Switch to Gemini 2.5 Flash for extraction** — The extraction prompt (Prompt A) doesn't need Pro-level reasoning. Flash is 3-5x faster and cheaper. Keep Pro for classification (Prompt B) where nuance matters.

### Expected Improvement

| Metric | Current | After Fix |
|--------|---------|-----------|
| Records/minute | ~1 | ~6-9 |
| Time for 79 records | ~80 min | ~10-15 min |
| Cost per record | ~$0.06 | ~$0.03 |

### Files Changed

- `supabase/functions/batch-process-research-records/index.ts` — Reduce batch size to 5, parallelize 3-at-a-time, remove 2s delay
- `supabase/functions/process-research-record/index.ts` — Use Flash for extraction (Prompt A), keep Pro for classification (Prompt B)

