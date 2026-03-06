

## Merge Extraction + Classification into a Single Prompt

### Goal
Reduce per-record research cost from ~$0.11 to ~$0.07 by combining Prompt A (extraction) and Prompt B (classification) into one Gemini Flash call, eliminating the second LLM invocation entirely.

### How it works

**File: `supabase/functions/process-research-record/index.ts`**

1. **Merge the two default prompts into one** — a new `DEFAULT_MERGED_PROMPT` that includes both the extraction JSON schema and the classification JSON schema in a single system prompt. The output JSON will have two top-level keys: `extraction` (current Prompt A output) and `classification` (current Prompt B output). This keeps the stored data structure identical to today.

2. **Replace the two-call flow with one call** — instead of calling `callLovableAI` twice (once for extraction, once for classification), call it once with the merged prompt. The transcript goes directly as the user message.

3. **Split the parsed result before storing** — after parsing the merged JSON response, split into `extraction` and `classification` objects and store them in the same `research_extraction` and `research_classification` columns. All downstream code (ProcessedRecordsList, HumanReviewQueue, ReasonCodeDrillDown, generate-research-insights) continues to work unchanged.

4. **Log cost as a single entry** — one `api_costs` row with `service_type: 'research_merged'` instead of two separate rows. The cost is lower because: (a) one call instead of two, (b) Flash model instead of Pro for classification, (c) no redundant token processing (Prompt B currently receives the full extraction JSON as input, which duplicates much of what Prompt A already processed).

5. **Update prompt lookup** — check `research_prompts` table for a `merged` prompt_key first. If found, use it. If not found, fall back to the hardcoded default. If neither `merged` nor separate `extraction`/`classification` keys exist, use the default merged prompt.

**File: `src/components/research-insights/ResearchPromptsSettings.tsx`**

6. **Update the settings UI** — add a `merged` prompt key label so super-admins can edit the merged prompt. Keep the old `extraction` and `classification` labels visible but mark them as "(Legacy)" so existing saved prompts aren't lost.

### What stays the same
- Database columns (`research_extraction`, `research_classification`) — no schema change
- All downstream consumers (ProcessedRecordsList, HumanReviewQueue, ReasonCodeDrillDown, generate-research-insights)
- The `batch-process-research-records` function (it just calls `process-research-record` per record)
- Cost logging structure (same `api_costs` table)

### Cost math
- Current: ~28k input tokens (Flash) + ~4k output (Flash) + ~6k input (Pro) + ~3k output (Pro) = ~$0.036 + ~$0.031 = **$0.067 + $0.035 transcription = $0.11**
- Merged: ~28k input tokens (Flash) + ~7k output (Flash) = ~$0.026 + $0.035 transcription = **~$0.06** (below target)

### Risk mitigation
- The merged prompt asks for a larger JSON output, but Flash handles this well with `response_format: { type: 'json_object' }`
- The `parseJsonWithRetry` function already handles malformed responses
- If the merged output is missing the `classification` key, mark for human review automatically

