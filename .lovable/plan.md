
Root-cause analysis (from live runtime + code):
1) Frontend/backend contract mismatch prevents reliable UI tracking.
- `useResearchInsightsData.generateReport()` expects `data?.insight_id`, but edge function returns `insightId`.
- Client sends snake_case payload (`campaign_id`, `analysis_period`), function reads camelCase (`campaignId`, `analysisPeriod`), so filters/period are ignored.
- Effect: users click Generate, backend starts, but UI often stops showing active progress correctly.

2) Aggregation pipeline still fails at synthesis due schema drift in chunk outputs.
- Current chunks are valid JSON, but `executive_summary` is often a string instead of object.
- `programmaticMerge()` assumes object and crashes (`Cannot create property 'total_cases' on string ...`), causing final failure after chunk processing.

3) Failure recovery is incomplete.
- Stuck/failed processing records continue to create confusion in list state and “latest processing” checks.

Implementation plan (deep reset of research insights generation reliability):
A) Fix API contract alignment (frontend + edge function)
- File: `src/hooks/useResearchInsightsData.ts`
  - Accept both response keys: `insight_id` and `insightId`.
  - Keep robust error extraction for function errors.
- File: `supabase/functions/generate-research-insights/index.ts`
  - Accept both input naming styles:
    - `campaignId || campaign_id`
    - `dateRangeStart || date_range_start`
    - `dateRangeEnd || date_range_end`
    - `analysisPeriod || analysis_period`
  - Return both keys for backward compatibility:
    - `{ insightId, insight_id }`.

B) Harden chunk parsing + normalization before storage
- File: `supabase/functions/generate-research-insights/index.ts`
  - Add `normalizeChunkResult(raw)` to enforce canonical shape before pushing to `_chunks`.
  - If `executive_summary` is a string, convert to:
    - `{ headline: <string>, total_cases: chunk.length, ...safe defaults }`.
  - Ensure all expected arrays exist (`reason_code_distribution`, `issue_clusters`, `top_actions`, etc.).
  - Reject non-object chunk payloads; log and continue with structured fallback object instead of raw model output.

C) Replace fragile merge with schema-safe merge
- File: `supabase/functions/generate-research-insights/index.ts`
  - Update `programmaticMerge()` to operate only on normalized objects.
  - Add guards for every nested field type before property writes.
  - If synthesis AI result is malformed, always fall back to merge without throwing.

D) Make finalization resilient
- File: `supabase/functions/generate-research-insights/index.ts`
  - Wrap synthesis parse with strict validation (`isValidAggregateReport`).
  - If invalid: use merge result.
  - If merge still partial: write a minimal valid report (never leave status as failed for type-shape issues alone).
  - Keep hard-fail only for true infra errors (DB/auth/network).

E) Cleanup + operational safety
- Data fix (one-time): mark currently stuck/invalid `processing` rows as `failed` with explicit message.
- Keep existing staleness guard, but ensure only one active processing report is considered when actually fresh.

Technical details section:
- Key bug to fix immediately: `insight_id` vs `insightId` mismatch (this is the biggest “nothing happens” UX symptom).
- Key reliability fix: normalize AI JSON shape at chunk boundary, not only at final synthesis.
- Principle: AI output is untrusted structure; enforce schema before storing/merging.
- No schema migration required; this is code-level hardening and data cleanup only.

Validation plan after implementation:
1) Trigger report generation and confirm UI immediately enters “Generating…” with chunk progress.
2) Verify progress advances chunk-by-chunk to synthesis and completes.
3) Confirm new report appears in selector with `status=completed`.
4) Run with different date range + campaign filters and confirm backend respects selected filters.
5) Re-run end-to-end on a large dataset (150+ records) to confirm no regression in self-chaining.
