## Goal

Fix two issues in Payment Experience open-ended clustering:
1. Non-answers like "I don't know" landing inside substantive clusters (e.g., "Add monthly/biweekly options" on Q16).
2. Too few clusters created — Gemini defaults to 5–8 even when 15+ are warranted.

## Changes

### 1. Edge function `cluster-pe-open-ended` — stricter system prompt

- **Force a dedicated `no_answer` cluster.** Hard rule: any response that is a non-answer ("I don't know", "no idea", "n/a", "nothing", "none", "no comment", "skip", blanks-equivalents) MUST go into a single `no_answer` cluster and MUST NOT be placed in any substantive cluster.
- **Push for finer granularity.** Add explicit instructions:
  - Target cluster count: `clamp(round(uniqueResponses / 6), 6, 20)` — passed in as a hint.
  - No single substantive cluster may exceed ~25% of total responses; if it would, split it by sub-theme.
  - Each cluster label must be distinct and specific (no overlapping themes).
  - Include 2–3 short payment-domain examples in the prompt to anchor specificity (e.g., separate "Lower the price" vs "Offer discounts/promos" vs "Reduce fees").
- **Post-Gemini server-side guard:** scan returned assignments; any response matching the no-answer regex gets reassigned to `no_answer` regardless of what Gemini said.

### 2. Second-pass split (oversized clusters)

After the first Gemini call returns:
- Identify any substantive cluster with `> 25%` of total responses AND `> 30` unique responses.
- For each such cluster (cap at 2 per question to bound cost), issue a single follow-up Gemini call that splits just that cluster's responses into 3–6 sub-clusters with the same rules.
- Replace the oversized cluster with its sub-clusters in the final result.
- All counts/responses preserved; `no_answer` cluster never split.

### 3. Cache invalidation — truncate

- Truncate `payment_experience_open_ended_cluster_cache` via the data tool so all PE open-ended questions re-cluster with the improved prompt on next view.
- Only this cache table is affected — no survey data, bookings, or other tables touched.

### 4. Scope (unchanged)

- Topic tabs, CSV export, printable report, non-open-ended questions, deterministic fallback, auth/JWT model, persistent cache schema — all unchanged.
- Model key stays `google/gemini-2.5-flash` (no `@v2` suffix since we're truncating).

## Files

- `supabase/functions/cluster-pe-open-ended/index.ts` — updated system prompt, no-answer guard, second-pass split logic, target-count hint.
- Data operation — `TRUNCATE payment_experience_open_ended_cluster_cache`.

## Acceptance

- "I don't know" / non-answers appear only in a `no_answer` cluster, never in substantive ones.
- Questions with many uniques produce noticeably more clusters (target 6–20 based on volume).
- No substantive cluster dominates with >25% of responses unless it cannot be split further.
- All valid responses still assigned to exactly one cluster; counts preserved including duplicates.
- Deterministic fallback unchanged; AI failures still degrade gracefully.
- Repeated visits hit cache after first regeneration.
