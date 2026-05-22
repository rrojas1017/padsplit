# Durable Raw Answer Persistence — Phase 1 (Runtime Only)

Persist actual selected answers for every Script Builder survey at submission time. AI-extraction reconstruction is deferred to a later phase.

## 1. Shared helper — `src/utils/rawScriptAnswers.ts` (new)

Exports:

- `RawScriptAnswer` — `{ question_id, question_text, ai_hint, question_type, selected_option_labels, raw_text_answer, scale_value, answered_at, source }`
- `RawScriptAnswerSource = 'agent_runtime' | 'ai_extraction'`
- `buildRawScriptAnswers(questions, responses, opts?: { source?, answeredAt?, optionGetter? })`
  - Walks questions, looks up response by stable `String(q.id)` and falls back to array-index key for legacy runtimes.
  - Skips unanswered (null/undefined/empty-string/empty-array).
  - Per type:
    - `multiple_choice` → `selected_option_labels: [label]`
    - `multiple_select` → `selected_option_labels: labels[]`
    - `yes_no` → `selected_option_labels: ['Yes' | 'No']`
    - `scale` → `scale_value: number`
    - `open_ended` → `raw_text_answer: string`
  - Always includes `question_id`, `question_text`, `ai_hint` (from `ai_extraction_hint`), `question_type`, `answered_at` (default `new Date().toISOString()`), `source` (default `'agent_runtime'`).
- `getRawScriptAnswer(extraction, questionId)` — safe lookup into `extraction?.raw_script_answers?.[questionId]`.

Pure utility, no Supabase imports.

## 2. Stable question IDs

Update `ScriptQuestion.id` to accept `string | number` (kept loose to avoid breaking existing rows).

- `src/components/script-builder/QuestionCard.tsx` / `StepQuestions.tsx`:
  - `emptyQuestion` and any add/duplicate paths assign `id: 'q_' + crypto.randomUUID().slice(0, 8)` immediately.
  - Duplicate generates a fresh id; never reuses the source id.
- `src/hooks/useResearchScripts.ts`:
  - Add a small `ensureQuestionIds(questions)` that fills missing ids (stringifies numeric ids only when used as a map key — do not rewrite the stored value). Called in `createScript` and `updateScript` before write.
  - IDs already present (number or string) are preserved as-is.
- `src/hooks/useScriptTranslation.ts`:
  - After receiving translated questions, copy `id` (and `ai_extraction_hint`) from the source question at the same index onto the translated question before persisting. Guarantees `questions_es` matches `questions` id-for-id.

No DB migration (JSONB).

## 3. Live-agent runtime — `src/hooks/useResearchCalls.ts`

- Extend `CallSubmission` with `script_questions?: ScriptQuestion[]`.
- `LogSurveyCall` passes the active campaign's `script.questions` into `submitCall`.
- In `submitCall`:
  - Continue inserting `responses` into `research_calls.responses` exactly as today.
  - If `script_questions` is provided, build `rawAnswers = buildRawScriptAnswers(script_questions, submission.responses)`.
  - Persist `rawAnswers` via a new edge function `persist-research-raw-answers` (see §5) — fire after the `research_calls` insert, non-blocking on failure (toast warning, never block the submit success path).

Guardrail: no frontend read-then-update merges into `booking_transcriptions`. All merging happens server-side in the edge function with service role.

## 4. Public script runtime

- `src/pages/PublicScriptView.tsx`:
  - On `phase === 'done'` (non-early-end completion), POST to new edge function `submit-public-script` with `{ token, responses, probeNotes, agentNotes, endedEarly, earlyDisposition, durationSeconds }`.
  - Fire once; show a small "saved" indicator; failure → toast but keep the existing thank-you UI.
- `supabase/functions/submit-public-script/index.ts` (new):
  - CORS (`npm:@supabase/supabase-js@2/cors`).
  - Validate token via the same logic as `validate-script-token` (duplicated here per the no-`src/` import rule).
  - Resolve script server-side (fetch `research_scripts` row).
  - Build normalized `raw_script_answers` inline (duplicate the small builder; trivial code, no `src/` import).
  - Service-role insert into `research_calls` with `responses` (legacy shape) AND create/find the linked research booking + `booking_transcriptions` row, writing `research_extraction.raw_script_answers` (merging onto any existing `research_extraction` JSON in a single atomic SQL via `update ... set research_extraction = coalesce(research_extraction,'{}'::jsonb) || jsonb_build_object('raw_script_answers', ...)`).
  - Never overwrites an existing `raw_script_answers` block — uses `jsonb_object_agg` style merge so individual question keys union with existing keys, with existing keys winning.

## 5. Server-side merge helper — `supabase/functions/persist-research-raw-answers/index.ts` (new)

Used by §3 (and reusable later).

- Auth: verify caller JWT (service-role client + `auth.getUser(token)`); reject anon.
- Input: `{ research_call_id, raw_script_answers }`.
- Looks up linked booking via `bookings.research_call_id = research_call_id`.
- If `booking_transcriptions` row exists for that booking, merges `raw_script_answers` into `research_extraction` (existing keys win); if not, no-op (live agent path may not have a transcription row, and that's fine — `research_calls.responses` is still the source of truth for live-agent dashboards).
- Logs to `api_costs` as `is_internal = true` is unnecessary here (no AI call); skip.

## 6. Payment Experience compatibility — `src/utils/paymentExperienceScriptResponses.ts`

Only change: import `getRawScriptAnswer` from the new helper and use it in `getAnswer` in place of the current inline `extraction?.raw_script_answers?.[questionId]` lookup. Identical behavior, identical precedence chain:

1. `raw_script_answers[qid]` (now via shared helper)
2. `payment_literacy_breakdown.*` / `*_stated` fields
3. legacy AI-derived fields

No other changes. Existing PE backfills and `process-research-record` PE logic untouched.

## 7. Types — `src/types/research-insights.ts`

- Re-export `RawScriptAnswer` from the new helper (single source of truth) or widen the existing `RawScriptAnswer` interface to drop PE-specific fields and match the new shape exactly.
- Keep `PaymentExperienceExtraction.raw_script_answers` typed as `Record<string, RawScriptAnswer> | undefined`.

## 8. Deferred (NOT in this phase)

- Generic `process-research-record` raw-answer reconstruction.
- Campaign-wide AI extraction strategy registry.
- Broad audio/API extraction path changes.
- Normalized answer table.
- Dashboard UI changes.

## 9. Files

New:
- `src/utils/rawScriptAnswers.ts`
- `supabase/functions/submit-public-script/index.ts`
- `supabase/functions/persist-research-raw-answers/index.ts`

Edit:
- `src/types/research-insights.ts`
- `src/hooks/useResearchScripts.ts`
- `src/hooks/useResearchCalls.ts`
- `src/hooks/useScriptTranslation.ts`
- `src/components/script-builder/QuestionCard.tsx`
- `src/components/script-builder/StepQuestions.tsx`
- `src/pages/research/LogSurveyCall.tsx` (pass `script.questions` into `submitCall`)
- `src/pages/PublicScriptView.tsx`
- `src/utils/paymentExperienceScriptResponses.ts`

## 10. Acceptance verification

- Create a new Script Builder question → inspect saved row → `id` is `q_xxxxxxxx`.
- Edit and re-save → `id` unchanged.
- Translate → `questions_es[i].id === questions[i].id`.
- Run a Public Script via a token → new `research_calls` row exists with `responses` populated AND linked `booking_transcriptions.research_extraction.raw_script_answers` populated.
- Submit a LogSurveyCall → `research_calls.responses` populated; if the linked booking already has a transcription row, `raw_script_answers` merged in; if not, submit still succeeds.
- PE dashboard renders identically.
- No TS errors.
