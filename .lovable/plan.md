# P5-CLEAN — cost logging consolidation + dead code

Scope: cost logging only. Request/response shapes, auth guards and business behaviour stay exactly the same. Every new/changed cost write uses `_shared/costs.ts` `logApiCost` (awaited, never throws) and `tokensFromUsage(json, promptText, outputText)`. No prompts, transcripts or personal data in metadata (only `model`, latency, counts, ids already logged today). No migrations/config. Not published.

## 1) Remaining local cost math → shared module

| Function | Today | Change |
|---|---|---|
| batch-generate-qa-coaching | Local `logApiCost` at lines 9–49 (old flat rates). It is defined but never called (the function only hands work to other functions). | Delete lines 9–49. No call sites to change, so no new rows. |
| compare-llm-providers | `DEEPSEEK_PRICING` / `GEMINI_PRICING` + cost helpers (lines 11–30); array insert (lines 324–352) | Delete the pricing blocks. Replace the insert with two awaited `logApiCost` calls using the same values (`ai_llm_comparison`, `compare-llm-providers`, `booking_id`, `triggered_by_user_id: user.id`, `is_internal: true`, providers lovable_ai / deepseek, model + latency in metadata). The console summary line and response use `llmCost(...)` for the same numbers. Token counts come from the existing usage parsing (lines 101–113, 156–168), switched to `tokensFromUsage`. |
| reclassify-records | Inline insert with hard-coded flash rate (lines 251–262) | `logApiCost` with the same `reclassification` / `reclassify-records` / `booking_id: null` / `is_internal: true` / metadata. Tokens via `tokensFromUsage` in the AI helper (lines 60–90). |

## 2) BIL-04 — add missing cost rows

Missing (skipped): backfill-payment-experience-names, backfill-payment-experience-progress, backfill-survey-progress, batch-reanalyze-member-details.

| Function | Model call (line) | service_type | Attribution | booking_id |
|---|---|---|---|---|
| backfill-markets-from-transcriptions | gateway flash-lite (46–63) | `market_backfill` | is_internal true, triggered_by = caller | yes (one record per call) |
| backfill-pricing-data | gateway flash-lite (30–47) | `pricing_backfill` | is_internal true, triggered_by = caller | yes |
| batch-extract-lifestyle-signals | gateway flash-lite (206–224) | `lifestyle_extraction` | is_internal true, triggered_by = caller or null | yes |
| cluster-pe-open-ended | gateway flash, 2 call sites (190–216, 296–313) | `pe_open_ended_clustering` | caller from its own JWT check (353+): triggered_by = user id, is_internal = super_admin | no |
| generate-audience-survey-executive-brief | `callModel` (96–114), can be called more than once (fallback) | `audience_executive_brief` | auth.ctx: userId / role==='super_admin' | no |
| generate-coaching-quiz | gateway flash (128–162) | `coaching_quiz` | auth.ctx | yes (bookingId) |
| generate-executive-brief | gateway flash (180–206) | `research_executive_brief` | auth.ctx | no |
| generate-pe-executive-brief | `callModel` (125–147) | `pe_executive_brief` | auth.ctx | no |
| parse-research-script | openai/gpt-5 (53–153) | `research_script_parse` | auth.ctx | no |
| translate-script | gemini-3-flash-preview (64–134) | `research_script_translation` | user path: auth.ctx; public-token path: triggered_by null, is_internal false | no |
| compare-stt-providers | ElevenLabs (31–47) + Deepgram (66–107) | `stt_comparison` (two rows: elevenlabs / deepgram, `audio_duration_seconds` = each provider's `durationSeconds`) | is_internal true, triggered_by = caller | yes (bookingId) |

- Gateway rows: `service_provider: 'lovable_ai'`, model in metadata. Cost is logged only when a response body was parsed (successful or parse-failed reply), after the call and before returning.
- Where auth.ctx is only in the handler, pass `{userId, isInternal}` into the helper that makes the call (a signature change inside the file only).
- compare-stt-providers keeps its local display costs in the response unchanged (response shape rule); only the logged rows use `sttCost`.

## 3) Dead code
- `src/pages/MemberInsights.tsx`: nothing imports or routes it. App.tsx line 211 only redirects `/member-insights` → `/call-insights?tab=bookings` with `<Navigate>`, so the redirect keeps working. Delete it. Its `member-insights/*` component imports go with it (the components stay).
- `src/components/audience-survey/AdAwarenessPanel.tsx`: **kept**. `AudienceSurveyDashboard.tsx` imports it (line 8) and renders it (line 88).

## Verification
- deno check every changed function (14). Deploy them. Unsigned POST {} → 401/403 each.
- `tsgo --noEmit -p tsconfig.app.json`.
- No paid calls; nothing published; roadmap.md updated.
