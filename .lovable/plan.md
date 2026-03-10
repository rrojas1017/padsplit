

## Fix: Edge function killed before completing analysis

### Root Cause

The polling fix IS working — the UI now correctly shows "Analyzing 175 records... Chunk 0 of 6 complete." But the **backend edge function is dying** before it can finish even chunk 1.

The logs show:
- 20:47:33 — Started chunk 1/6
- 20:50:51 — Worker shutdown (killed after ~3 min)
- No chunk completion logged

The problem: **Gemini 2.5 Pro** is configured as the aggregation model. Pro takes 60-90+ seconds per chunk. With 6 chunks + synthesis, that's 7-10 minutes total. But `EdgeRuntime.waitUntil()` has a ~150-second background execution limit. The function gets killed mid-chunk-1.

Report `e2446dea` is now permanently stuck as "processing," which also blocks new attempts due to the concurrency guard (line 587).

### Fix (2 changes)

**1. Switch default aggregation model to Flash**

Update the `research_prompts` table: change the aggregation model from `google/gemini-2.5-pro` to `google/gemini-2.5-flash`. Flash responds in 5-15 seconds per chunk vs 60-90s for Pro, so all 6 chunks + synthesis can complete well within the background execution window (~150s total vs the current ~600s).

This is a database update only — no code change needed since line 570 already reads from the DB.

**2. Mark the stuck report as failed**

Update `e2446dea` status to `failed` so the concurrency guard doesn't block new attempts.

**3. Add a per-chunk timeout to prevent silent hangs**

In `supabase/functions/generate-research-insights/index.ts`, wrap each `callLovableAI` in a `Promise.race` with a 60-second timeout. If a single chunk takes longer than 60s, it fails fast instead of hanging until the worker is killed. This ensures the error is caught and reported properly rather than the function silently dying.

```typescript
// Around line 307
const chunkTimeout = new Promise<never>((_, reject) =>
  setTimeout(() => reject(new Error(`Chunk ${i+1} timed out after 60s`)), 60000)
);
const result = await Promise.race([
  callLovableAI(lovableApiKey, model, temperature, systemPrompt, userMsg),
  chunkTimeout
]);
```

### Files to edit
- `supabase/functions/generate-research-insights/index.ts` — add per-chunk timeout
- Database migration: update `research_prompts` aggregation model to Flash, mark stuck report as failed

