## Payment Experience Executive Brief (Word Report)

Mirror the Move-Out report architecture, adapted for PE data.

### 1. New files

- `src/utils/generate-pe-docx.ts` — builds the `.docx` (deterministic KPIs + AI narrative)
- `supabase/functions/generate-pe-executive-brief/index.ts` — Gemini **2.5 Pro** narrative generator
- `supabase/config.toml` — register the new function with `verify_jwt = true`

### 2. Trigger

Add a **Download Word Report** button on the PE Insights dashboard (`PaymentExperienceInsightsDashboard.tsx`), matching the Move-Out placement. It passes the **currently-filtered** records (date range / filters from the dashboard hook) into `generatePEDocx()` — same scoping behavior as Move-Out.

### 3. Document structure

1. **Title block** — "PadSplit — Payment Experience Executive Brief", date range, respondent count
2. **KPI table** (recomputed from raw data, never AI):
   - Members Surveyed
   - Avg Payment Literacy (/100)
   - Auto-pay Enrolled %
   - Move-in Cost Clarity (/5)
   - Hardship-Aware %
   - Pay-cycle Misalignment %
3. **Executive Analysis** — AI narrative paragraphs (Gemini 2.5 Pro), grounded in the aggregates we pass in. Falls back to deterministic summary if AI fails.
4. **Per-question detail — every script question** (no top-N filter):
   - Question text, N responses, avg score (if Likert), distribution bar
   - For open-ended: top Gemini clusters from `payment_experience_open_ended_cluster_cache` with **counts + % share only** (no verbatim quotes), `no_answer` cluster shown separately
5. **Top friction themes & autopay barriers** — aggregate counts from existing analytics
6. **Recommended Actions** — AI bullets (max ~6) from Gemini 2.5 Pro
7. **Methodology appendix + footer**

### 4. Privacy

**Aggregate only** — no member verbatims, no names, no IDs in the docx. Clusters show labels + counts + share.

### 5. AI model

`google/gemini-2.5-pro` via Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`), matching Move-Out's executive brief quality tier.

### 6. Deterministic-first rule

All numbers (totals, %s, averages, distributions) are recomputed in `generate-pe-docx.ts` from the filtered raw records + cluster cache. AI writes prose only — never numbers.

### 7. Shared utility (optional, light refactor)

Extract KPI table + section builders into `src/utils/docx-shared.ts` so Move-Out and PE share primitives without duplication.

### Technical notes

- Reuse `usePaymentExperienceResponses` data already on the dashboard (filtered records, KPIs, friction themes, autopay barriers).
- For open-ended clusters, read from `payment_experience_open_ended_cluster_cache` keyed by `(questionId, responseHash)` — same source the dashboard uses.
- Edge function payload: `{ kpis, perQuestionAggregates, frictionThemes, autopayBarriers, dateRange, totalRespondents }` → returns `{ headline, executiveAnalysis: string[], recommendedActions: string[] }`.
- Browser-side `docx` library assembles and downloads — no server-side PDF/docx rendering.
