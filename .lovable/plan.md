
## Problem

Two things are missing from the generated Payment Experience Word report:

1. **Executive Analysis** shows the fallback "AI narrative unavailable…" — the `generate-pe-executive-brief` edge function is hitting the **150 s idle timeout** (504 IDLE_TIMEOUT in runtime errors). Gemini **2.5 Pro** with the full PE payload (16 questions + clusters + friction + barriers) regularly exceeds that budget.
2. **Open-ended questions (Q5, Q6, …)** all say "Clusters not yet generated." — `generate-pe-docx.ts` only **reads** clusters from `payment_experience_open_ended_cluster_cache`. If the user has never opened the in-app PE dashboard view that triggers `usePEOpenEndedClusters` for that exact response set, the cache is empty and the report shows nothing.

## Fix

### 1. Make the executive brief actually return in time

In `supabase/functions/generate-pe-executive-brief/index.ts`:

- Keep Gemini 2.5 Pro as the primary model (user explicitly chose Pro).
- Add a real request timeout via `AbortController` (e.g. 120 s) so we get a clean error instead of edge-function idle-timeout.
- On `AbortError`, 429, 5xx, or empty response: **automatically fall back to `google/gemini-2.5-flash`** with the same prompt. Flash returns in ~10–20 s and matches Move-Out's actual behavior under load.
- Trim the user prompt slightly to keep Pro fast: cap `topAnswers` at 4 and `clusters` at 5 in the per-question block (numbers stay deterministic in the docx itself; this only affects the prose context).
- Return `{ executive_brief, model_used }` so we can log which path produced it.

In `src/utils/generate-pe-docx.ts`:

- When the brief call fails or returns no narrative, show a clearer fallback line (still italic) but include the KPI summary sentence so the section is never empty in practice.

### 2. Generate missing open-ended clusters on demand from the docx generator

In `src/utils/generate-pe-docx.ts`, update `fetchClustersForQuestion`:

1. Look up the cache row by `(question_id, response_hash)` as today.
2. **Cache miss** with `responses.length >= 8`: invoke `cluster-pe-open-ended` (the existing edge function) directly with `{ questionId, questionText, responses, responseHash }`. That function already persists to the cache and returns the cluster payload synchronously.
3. Map the returned clusters into the same `{ label, count, pct }` shape used today.
4. Run all per-question lookups in `Promise.all` (already done) so the report generation parallelizes clustering across all open-ended questions.
5. If the on-demand invoke fails for one question, fall back to the existing "Clusters not yet generated." line for just that question — don't fail the whole report.

To avoid blowing the front-end UX:

- Wrap each per-question `supabase.functions.invoke('cluster-pe-open-ended', …)` in a 90 s soft timeout via `Promise.race` with a resolved-null fallback.
- Show a `toast.loading` update in `PaymentExperienceInsightsDashboard.handleDownloadReport` ("Generating clusters and narrative — this can take ~1 minute…") so the user understands the slower path. No new UI states needed beyond the existing `isGenerating` spinner.

### 3. No schema, no UI layout, no new files

- No new tables, no new migrations.
- No changes to the dashboard layout — only the toast copy in the existing handler.
- No new files; edits only to:
  - `supabase/functions/generate-pe-executive-brief/index.ts`
  - `src/utils/generate-pe-docx.ts`
  - `src/components/payment-experience/PaymentExperienceInsightsDashboard.tsx` (toast copy only)

## Expected result

- "Executive Analysis" populates with real prose (Pro when it fits in 120 s, Flash fallback otherwise).
- Q5, Q6, Q9, Q10, etc. show real AI cluster tables (label + count + %), generated on the fly and cached for next time.
- First report generation is slower (~1–2 min) because clusters get built; subsequent reports are fast (cache hits).
