

## Fix: Research Insights generation failing with "Unexpected end of JSON input"

### What happened

The latest report (`68637751`) failed immediately after processing chunk 1/4. The AI model (Gemini 2.5 Pro) returned a truncated JSON response for the first chunk of 50 records. The `JSON.parse` threw "Unexpected end of JSON input", which was caught at the chunk level (line 313) but the error propagated because the chunk result was skipped. Looking at the pattern:

- `68637751` (just now): Failed at chunk 1 — truncated AI response
- `a40f62b4`: Failed during synthesis — edge function killed
- `67e14d0c`: Failed during synthesis — edge function killed
- Last success (`e6d4fc4f`): 114 records, 6 days ago

The root causes are:
1. No retry when a chunk's AI response is truncated/unparseable
2. If all chunks fail to parse, `chunkResults` is empty and the synthesis call still fires with empty data, causing another failure
3. The error at line 313 is silently swallowed but the outer `processInsights` catch picks up a later failure

### Changes

**File: `supabase/functions/generate-research-insights/index.ts`**

1. **Add per-chunk retry (1 retry with explicit "respond only with JSON" instruction)**
   - Lines 304-328: When `JSON.parse` fails for a chunk, retry the AI call once with an explicit "no markdown, pure JSON only" instruction appended
   - This handles the common case of truncated or markdown-wrapped responses

2. **Guard against empty chunkResults before synthesis**
   - After the chunk loop (line 329), if `chunkResults.length === 0`, mark the report as failed with a clear message ("All chunk analyses returned invalid JSON") instead of attempting synthesis on empty data

3. **Add content length validation before parsing**
   - Before `JSON.parse`, check if the AI response content length is reasonable (> 100 chars). If suspiciously short or empty, skip to retry immediately

### Summary
- `supabase/functions/generate-research-insights/index.ts`: Add per-chunk retry on JSON parse failure, guard against empty synthesis input, validate response length

