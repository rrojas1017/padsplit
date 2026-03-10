

## Fix: No progress bar + report keeps failing with truncated JSON

### Root Cause

The report `4a28f2ab` already **failed** — it crashed on chunk 2/4 with "Unexpected end of JSON input." Both the initial attempt and retry returned truncated JSON. The UI correctly transitioned from "Generating..." to the failed state, but it happened so fast there was no visible progress bar.

The underlying problem: **50 records per chunk is too large**. The AI model hits its output token limit trying to produce the full analysis JSON for 50 records, resulting in truncated output. This has failed on every attempt with 162 records.

### Changes

**1. Reduce chunk size from 50 to 30 records**

`supabase/functions/generate-research-insights/index.ts` — line 261

Change `CHUNK_SIZE = 50` to `CHUNK_SIZE = 30`. This produces 6 smaller chunks instead of 4 large ones. Each chunk's output will be well within token limits.

**2. Add explicit `max_tokens` to the AI call**

In `callLovableAI` (line 462), add `max_tokens: 16384` to the request body. This tells the model to reserve enough output space for the full JSON response rather than being silently truncated.

**3. Trim the input data sent per record**

In the `recordSummaries` builder (lines 244-257), remove `JSON.stringify(chunks[i], null, 2)` pretty-printing and use compact JSON (`JSON.stringify(chunks[i])`) in the user message. This reduces input token usage by ~30%, giving the model more budget for output.

### Summary
- `supabase/functions/generate-research-insights/index.ts`: Reduce chunk size 50→30, add max_tokens, use compact JSON in prompts

