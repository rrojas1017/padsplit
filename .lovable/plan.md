# BUG-003 Phase A — research form submissions visible in Reports, early ends kept, per-script filter

No migrations, no RLS, no new deps, no publish. Do not touch Leaderboard.tsx, SiteFilter.tsx, useAgentGoals.ts. Reports' `record_type.neq.research,has_valid_conversation.eq.true` filter (useReportsData.ts:204) stays exactly as is. `resolveResearchCampaignType` routing unchanged in both functions.

## 1. supabase/functions/submit-public-script/index.ts
- After line 329 add `const createBooking = callOutcome === 'completed' || (callOutcome === 'ended_early' && answeredCount > 0);` and `const totalQuestions = questions.filter(q => q?.is_internal !== true).length;` (from the script already loaded).
- Line 370: `if (callOutcome === 'completed')` → `if (createBooking)`.
- Booking insert (~375–392): add `has_valid_conversation: true`.
- booking_transcriptions insert (~397–405): add `survey_progress: { answered: answeredCount, total: totalQuestions, ended_early: callOutcome === 'ended_early', disposition: endedEarly ? (earlyDisposition || null) : null, source: 'public_script' }`.
- Line 411: condition → `createBooking && answeredCount > 0`; row metadata gets `partial: true` when `callOutcome === 'ended_early'`.
- Lines 438–446 (total_responses / last_response_at): wrapped in `if (callOutcome === 'completed')`.
- Declines and zero-answer early ends: only the research_calls row (unchanged). Token checks, rate limits, idempotency, caps, duration handling unchanged.

## 2. supabase/functions/persist-research-raw-answers/index.ts
- Compute `answeredCount = Object.keys(raw_script_answers).length`, `endedEarly = call.call_outcome != null && call.call_outcome !== 'completed'`.
- Line 118 create condition → `call_outcome === 'completed' || call_outcome == null || answeredCount > 0`; insert (~127) adds `has_valid_conversation: true`.
- Linked booking (phone match, ~106) or booking found by research_call_id (~79): when `answeredCount > 0`, `update({ has_valid_conversation: true }).eq('id', booking.id).is('has_valid_conversation', null)` — never overwrites true/false.
- Load the script questions (script id already resolved for routing, ~160) to compute `total` (non-internal count).
- booking_transcriptions insert (~177): add `survey_progress` with the item-1 shape, `source: 'agent_runtime'`, disposition from `call.responses?._early_disposition` if present on the call row (select extended), else null.
- Existing row update (~195): include survey_progress only when the existing row's `survey_progress` is null (select extended at ~169).
- Ownership/role checks, merge rule, script_responses skip-if-exists, routing unchanged.

## 3. src/pages/PublicScriptView.tsx
- `const startedAtRef = useRef<number | null>(null)` set when the script starts (first question shown); submit payload (~168) adds `durationSeconds: startedAtRef.current ? Math.round((Date.now() - startedAtRef.current) / 1000) : undefined` for both completion and End Call. No UI change.

## 4. Reports
- NEW `src/utils/researchCampaignType.ts`: `BUILTIN_RESEARCH_TYPES`, `resolveResearchCampaignType(script)` (same rule as the functions: move-out/payment script mapping, `audience_survey`, else slug, else `script_<id8>`), `researchCampaignLabel(type, scriptLabels)` → "Move-Out" / "Audience" / "Payment" / script name / raw type.
- useReportsData.ts: one query `research_scripts.select('id, name, slug, is_active').eq('is_active', true)` exposing `researchScriptOptions: {value, label}[]` (built-ins excluded); map `surveyEndedEarly`, `surveyDisposition` from `survey_progress` (~402). Filter at ~268 unchanged (already filters by research_campaign_type).
- Reports.tsx:
  - Filter dropdown (~695–730): keep 3 options, append script options; button label = selected option's label (lookup), not the "Audience Survey" fallback.
  - Campaign column (~1105) and CSV export (~334): use `researchCampaignLabel`; no Move-Out default.
  - "Ended early" Badge + Tooltip (`<disposition> · answered/total`) next to the label when `surveyEndedEarly`.

## 5. src/components/research-insights/ScriptInsightsPanel.tsx
- `useAuth()`; `canSeeSubmissions = role in ('super_admin','admin')`. Third tab "Submissions" rendered only then.
- Query (enabled only then): `research_campaigns.select('id').eq('script_id', scriptId)` → `research_calls.select('id, created_at, caller_type, call_outcome, language, call_duration_seconds, responses, researcher_id').in('campaign_id', ids).order('created_at', {ascending:false})`, paginated 1000.
- KPI cards: Total, Completed, Ended early, Refused/declined (refused|declined).
- Table (latest 200): date/time (ET), source (Public link / Researcher runtime), outcome, `responses._early_disposition`, answered (keys not starting with `_`), language, duration. No names/phones.
- Empty-responses early return (line 126) moved so the Submissions tab still renders when there are submissions but no script_responses.

## 6. roadmap.md — one Done line.

## Verification
tsgo clean; deno check both functions; deploy only those two; unsigned POST {} → 401 where applicable (submit-public-script is token-based, so a bad token → 4xx). No real submissions made by me.

## Possible conflicts / notes
- useReportsData.ts:271 filters research rows on `survey_progress->>answered >= 1` for some view; new rows always have answered ≥ 1, so fine — zero-answer ends are intentionally not bookings.
- Item 5 gate is client-side role only; RLS on research_calls for supervisors was not re-checked (spec says they can't read it).
- Existing move-out / audience / payment rows are untouched; their labels change wording only in the Campaign column/CSV ("Move-Out Survey" → "Move-Out", etc.) as specified.
