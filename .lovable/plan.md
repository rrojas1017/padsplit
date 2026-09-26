# CR-010 Phase 3 — Word executive brief for script-survey dashboards

The Word button on the 30-Day Member Experience and Non-Booking Conversion dashboards will download an executive brief in the same format as the Payment Experience (PE) brief. It replaces the current generic report.

## What exists today

- **`src/utils/generate-pe-docx.ts`** (528 lines) builds the PE brief.
  - Styling: `NAVY_HEX 1A365D`, `LIGHT_BG`, `KPI_BG E8F0FE`, and the `headerCell` / `cell` / `stripUUIDs` helpers.
  - Clusters: `sha256Hex` and `fetchClustersForQuestion` read `payment_experience_open_ended_cluster_cache`. On a cache miss they call `cluster-pe-open-ended` with a 90 s timeout. Questions with fewer than 8 responses get no clusters. Warnings are tagged `[generate-pe-docx]`.
  - Narrative: `fetchPEBrief` calls `generate-pe-executive-brief`.
  - Output: a Methodology section, a "PadSplit Payment Experience — Confidential" header, and a `PadSplit-Payment-Experience-Brief-yyyy-MM-dd.docx` file.
- **`generate-pe-executive-brief`** (edge function):
  - Access: `requireUser(req, MANAGERS)`.
  - Models: Gemini 2.5 Pro with a 110 s timeout, then Flash with a 30 s timeout.
  - Cost: `logApiCost(adminClient(), { service_provider: 'lovable_ai', service_type: 'pe_executive_brief', ... })`.
- **Cost types:** `api_costs` has a CHECK constraint on `service_provider` only; `service_type` is free text. The billing UI keeps no list of allowed types; unknown types fall back to a gray color in `RealtimeCostDashboard`. So **no database or billing change is needed** for `script_survey_executive_brief`.
- **`cluster-pe-open-ended`** accepts any `questionId` up to 200 characters. `${scriptId}:${q.id}` fits.

## Build

### 1. Shared cluster helper: `src/utils/openEndedClusterFetch.ts` (new)
- `sha256Hex` and `fetchClustersForQuestion(questionId, questionText, responses, logTag = '[generate-pe-docx]')` move here from `generate-pe-docx.ts` with identical bodies.
- The one difference is the log tag, which becomes a parameter whose default is PE's tag. PE's warning text stays identical.
- `generate-pe-docx.ts` imports them and deletes its local copies. Nothing else in that file changes, so the PE file's output is the same.

### 2. KPI config additions: `src/config/scriptSurveyKpis.ts`
- `formatKpiValue` and `kpiDenominator` move here from the dashboard. The dashboard and the brief both import them, so the numbers match.
- New `SCRIPT_SURVEY_PURPOSE: Record<scriptId, string>` with the two purpose texts given in the ticket.

### 3. Brief generator: `src/utils/generate-script-survey-docx.ts` (new)
- **Signature:** `generateScriptSurveyDocx({ scriptId, scriptName, questions, sections, records, validRecords, eligibleRecords, kpiConfig, kpis })`.
- **Styling:** copies PE's constants and cell helpers, and the same Arial styles, page size and margins.
- **Header and title:**
  - Page header "PadSplit <name> — Confidential", with a page-number footer.
  - Title "PadSplit — <name> Executive Brief", the generated date, and the period from the earliest to the latest `booking_date`.
- **KPI table:** a row of the 6 tiles on `KPI_BG`, using `formatKpiValue` and `kpiDenominator`.
- **AI narrative:** Executive Analysis, Risk Flags, and Recommended Actions (Priority / Recommendation / Owner / Rationale) from the new function. When the function fails, the brief shows PE's "AI narrative unavailable" fallback.
- **Per-Question Detail:**
  - One Heading 2 per section, in script order. `questions` already excludes internal questions, as on the dashboard.
  - Each question shows "Q<order>. text" and a meta line "n=… · avg=… · section".
  - Choice, yes/no and scale questions get an Answer / Count / % table built from `summarizeScriptQuestion`. Scale answers use one row per point.
  - Open-ended questions get a cluster table from `fetchClustersForQuestion(`${scriptId}:${q.id}`, q.question, summary.allResponses, '[generate-script-survey-docx]')`. This is the same array the dashboard passes, so the hash matches and cached clusters are reused. With fewer than 8 responses, or when clustering is unavailable, the line reads "Clusters unavailable".
- **No member quotes:** only aggregates appear, and text goes through `stripUUIDs`.
- **Methodology:**
  - The counts of routed calls, valid conversations and eligible respondents.
  - Answers come from the agent's typed form plus answers extracted from the call recording; when both exist, the typed form answer wins.
- **File name:** `PadSplit-<Name-Slug>-Brief-yyyy-MM-dd.docx`, where the slug turns non-alphanumerics into "-".
- **AI request body:**
  - `{ surveyName, surveyPurpose, kpis: [{label, value}], perQuestion, sections, totalRoutedCalls, validConversations, totalRespondents, dateRange }`.
  - `perQuestion` holds aggregates only: order, text, section, type, n, avg, top distribution rows, and cluster labels with counts.

### 4. Edge function: `supabase/functions/generate-script-survey-brief/index.ts` (new)
- A twin of `generate-pe-executive-brief`:
  - Access: `requireUser(req, MANAGERS)`.
  - Models and timeouts: the same Pro (110 s) then Flash (30 s) fallback.
  - Output: the same JSON shape (`executiveAnalysis`, `riskFlags`, `recommendedActions`, …), matched to PE's field names exactly.
  - Cost: `logApiCost` with `edge_function: 'generate-script-survey-brief'` and `service_type: 'script_survey_executive_brief'`.
- **System prompt:**
  - A generic senior research analyst.
  - Aggregate figures only, no quotes; candid and actionable.
  - Owners drawn from Member Support / Product / Property Ops / Sales / Marketing.
  - Narrative paragraphs follow the survey's own sections.
- **Input checks (400 on failure):**
  - `perQuestion` must be an array of at most 60 items.
  - Strings are cut to 500 characters.
  - `kpis` holds at most 12 items and `sections` at most 30.
  - Numbers must be finite.
- **Logging:** request bodies are never logged. Only the status, the model and the failure reason appear.
- Deployed after `deno check`. An unsigned POST `{}` should return 401.

### 5. Dashboard: `src/components/research-insights/ScriptSurveyInsightsDashboard.tsx`
- The Word button calls `generateScriptSurveyDocx` with the date-filtered records, valid records, eligible records and KPIs.
- It shows PE's toasts:
  - "Generating clusters and narrative — this can take ~1–2 minutes…"
  - "Executive brief downloaded"
  - "Failed to generate report"
- The `generateDynamicReport` import is removed from this file only. The local `formatKpiValue` and `kpiDenominator` are replaced by the imported ones.

## Files touched

New:
- `src/utils/openEndedClusterFetch.ts`
- `src/utils/generate-script-survey-docx.ts`
- `supabase/functions/generate-script-survey-brief/index.ts`

Edited:
- `src/utils/generate-pe-docx.ts`: the two helpers are replaced by imports; bodies are unchanged.
- `src/config/scriptSurveyKpis.ts`: the formatters and purpose texts are added.
- `src/components/research-insights/ScriptSurveyInsightsDashboard.tsx`

Not touched:
- The PE dashboard and `generate-pe-executive-brief`.
- The legacy script panel.
- RLS, auth, the database, `types.ts`, the billing UI.
- No new dependencies (`docx` is already installed).

## Verification

- `tsgo --noEmit -p tsconfig.app.json`.
- `deno check` on the new function, deploy it, then confirm an unsigned POST `{}` returns 401.
- A diff showing that the moved cluster helper bodies are identical to the PE originals.
- The brief will not be generated live, because that would spend AI credits and write cost rows. Nothing published.
