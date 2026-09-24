# P-G3: translation merge by key, per-script research mode, wizard defaults

Only these files change: translate-script, process-research-record, submit-conversation-audio (all under `supabase/functions/`) and `src/pages/research/ScriptBuilder.tsx`. Auth guards stay byte-identical. No migrations, RLS or config changes. No real calls to the functions, and nothing is published.

## Facts checked in the database (they shape the plan)
- None of the 3 new scripts (62aad78b, c24c5e6b, 827b23ef) has a slug. Their mode label will therefore be `script_62aad78b`, `script_c24c5e6b` and `script_827b23ef`.
- Every script stores `ai_model` without a vendor prefix (`gemini-2.5-flash`), except Payment Experience. The generic mode adds `google/` when there is no `/` in the value.
- submit-conversation-audio stamps `research_campaign_type` together with `retag_source='script_id_route'` before processing runs. process-research-record trusts that stamp and returns early (lines 151-163). With only the routing change, a generic record would come back as `script_xxx` and then drop into the move-out branch. The fix below makes the early return trust only the 3 known modes.
- Existing stamped rows use only move_out_survey, payment_experience and audience_survey (44,449 rows). Their path does not change.
- `raw_script_answers` is stored as an object keyed by question id; persist-research-raw-answers and PE use this format. The generic mode converts the AI's array into that object form.

## 1. translate-script/index.ts
- **Lines 51-59 (prompt payload):** send `key: String(index)` and keep `id: q.id` as pass-through only. The other text fields stay as they are.
- **Lines 92 and 100 (tool schema):** `id: {type:"number"}` becomes `key: {type:"string"}`, and `required` becomes `["key","text"]`.
- **Lines 155-172 (merge):**
  - Build `byKey = Map(key → tq)`. For each original question at index `i`, use `byKey.get(String(i)) ?? translated.questions[i]`, so a missing key falls back to array position.
  - Keep the whole source question with `{...origQ}`, so `id`, `order`, `type`, branch/goto fields, `scale_*`, `is_internal` and `ai_extraction_hint` are untouched.
  - Only these come from the translation: `text`/`question`, `options`, `probes`, `section`, and the branch `yes_probes`/`no_probes`.
  - If no translation exists for a question, keep the original and count it as missing.
- **Lines 174-179 (response):** add `partial: true` only when `translated.questions.length < questions.length` or any question had no match. The output array always has the same length as `questions`, because it is mapped from the originals.

## 2. process-research-record/index.ts: routing

**`SCRIPT_ID_MAP` (line 110):** add `'6397bb7f-ac6a-49ea-90ad-9ca6ec046434': 'move_out_survey'`.

**`CampaignContext` (line 114):** add `mode: 'legacy' | 'generic'` (default `'legacy'`), `scriptSlug`, `scriptQuestions`.

**Early returns 0a/0b (lines 151-163):** these return early only when the stamped type is in `KNOWN = ['move_out_survey','payment_experience','audience_survey']`. Any other stamp continues to the script lookup, so today's rows behave exactly as now.

**Script select (line 195):** add `questions`.

**Resolution (lines 205-212)** becomes the exact routing function:
```ts
if (SCRIPT_ID_MAP[script.id]) {                 // a) Move-Out id + PE id → as today
  ctx.campaignType = SCRIPT_ID_MAP[script.id];
} else if (script.slug && ['payment_experience','audience_survey'].includes(script.slug)) {
  ctx.campaignType = script.slug;               // b) as today
} else {                                        // d) every other script → generic
  ctx.mode = 'generic';
  ctx.campaignType = script.slug || `script_${String(script.id).slice(0, 8)}`;
  ctx.scriptSlug = script.slug || null;
  ctx.scriptQuestions = Array.isArray(script.questions) ? script.questions : [];
}
```
- c) When no script is found, keyword fallback and the move-out default stay unchanged.
- `mapCampaignType` (lines 256-262) becomes unused and is deleted.

## 2b. process-research-record/index.ts: generic mode
- **Transcript select (line 1062):** add `research_extraction`, so answers from the agent or public form are available.
- **New branch at line 1101:** a new `if (ctx.mode === 'generic') { ... } else if (campaignType === 'payment_experience')` chain goes first. The PE, audience and move-out branches are otherwise untouched.
- **Prompt:**
  - `systemPrompt = ctx.scriptAiPrompt || buildGenericScriptPrompt(ctx.scriptQuestions)`.
  - The new helper lists each question as `{question_id: q.id ?? q_idx_<i>, question: q.question ?? q.text, type, options}`.
  - It asks for strict JSON: `{raw_script_answers:[{question_id, answer_text, selected_options, scale_value}], summary, human_review_recommended}`.
  - It says "use null when not asked/answered; only use evidence from the transcript".
- **Model:** `normalize(ctx.scriptModel) || 'google/gemini-2.5-flash'`, where `normalize` adds `google/` when there is no `/`. Temperature is `ctx.scriptTemperature ?? 0.2`.
- **Call:** the same `callLovableAI` + `parseJsonWithRetry` with the transcript user message, identical to the PE branch.
- **Answers:**
  - Convert the AI array into `{[question_id]: {answer_text, selected_options, scale_value, source:'ai_extraction'}}`.
  - Merge as `{...aiMap, ...existingRaw}`, so existing answers win for the same question id.
  - `extraction = {raw_script_answers: merged, summary}`.
  - `classification = {human_review_recommended: parsed.human_review_recommended === true, source: 'script_survey'}`.
- **Cost:** `logApiCost` with `service_type 'research_script_survey'`, `edge_function 'process-research-record'`, `booking_id` and tokens. Metadata is `{model, prompt: ctx.scriptAiPrompt ? 'script' : 'generic', campaign_type, script_id}`, with `is_internal: false`.
- **Store:** the existing shared update (lines 1312-1336) writes `research_processing_status 'completed'` and `research_campaign_type`. The existing catch marks the record 'failed' on errors; no change there.
- **Logs:** counts and ids only, never transcript or answer text.

## 2c. submit-conversation-audio/index.ts (lines 164-193)
Mirror the same routing:
- Add the Move-Out id to `SCRIPT_ID_MAP`.
- Keep the PE/audience slug rule.
- Every other found script → `script.slug || 'script_' + id.slice(0,8)`.
- Delete `mapScriptCampaignType`.
- No script → `null` as today, so no stamp is written.

The stamp and upsert code is unchanged.

## 3. src/pages/research/ScriptBuilder.tsx (lines 92-96)
Change `|| null` / `?? null` to `|| undefined` / `?? undefined` for script_type, slug, ai_prompt, ai_model and ai_temperature. `createScript` already skips undefined values, so the database defaults apply.

## Verification
- `deno check` on the 3 functions. Pre-existing warnings are reported separately.
- `npx tsgo --noEmit -p tsconfig.app.json`.
- Deploy translate-script, process-research-record and submit-conversation-audio.
- No real calls. Only anon-key POST {} checks expecting 401.
