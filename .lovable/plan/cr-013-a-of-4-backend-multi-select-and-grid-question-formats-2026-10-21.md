# CR-013 (A of 4) — Backend: multi-select and grid question formats

No database change, nothing under `src/`, no `_shared/*`, no `config.toml`, no RLS. Auth, models, timeouts and cost logging stay as they are. Nothing logs request bodies or answers.

## Files touched (3)
1. `supabase/functions/translate-script/index.ts`
2. `supabase/functions/submit-public-script/index.ts`
3. `supabase/functions/process-research-record/index.ts`

## 1. translate-script
- Each question sent to the model also carries `matrix_title` and `matrix_row`, but only when `q.matrix` exists (other questions look exactly as they do today).
- The tool schema gets two optional string properties per question item: `matrix_title` and `matrix_row`.
- Merge: when `origQ.matrix` exists, `matrix: { ...origQ.matrix, title: tq.matrix_title || origQ.matrix.title, row: tq.matrix_row || origQ.matrix.row }`. Questions without a matrix get no `matrix` key.
- Confirmed: the merge starts with `...origQ`, so `id`, `type`, `max_selections`, `matrix.group`, `is_internal` and every other field come from the original question unchanged. Only text, options, probes, section, branch probes and now matrix title/row are replaced.
- The row's `question`/`text` ("<title> — <row>") is translated as a whole, the same way it is today.
- Auth, model, cost logging and the `partial` flag stay as they are.

## 2. submit-public-script
- In `buildRawScriptAnswers`, `case 'multiple_select'`: after trimming and dropping empty labels, if `q.max_selections` is a positive integer, keep only the first `max_selections` labels. Nothing else in that function changes.
- Grid rows need no change: they are `type: "multiple_choice"` and go through the existing `multiple_choice` case (one label → `selected_option_labels: [label]`), keyed by their own question id.
- BUG-005 save model, CR-005/007/009 linking and CR-012 call outcomes are not touched. Both callers (line ~365 live save, line ~861 stored answers) get the cap automatically.

## 3. process-research-record — what the generic path does today
Generic mode is used for per-script campaigns that aren't PE, audience or move-out (`ctx.mode === 'generic'`):
- Prompt: the script's own `ai_prompt` if it has one; otherwise `buildGenericScriptPrompt`, which lists `{question_id, question, type, options}` and asks for `{question_id, answer_text, selected_options[], scale_value}` per question.
- Storage: every AI entry is saved as `{ answer_text, selected_options, scale_value, source: 'ai_extraction' }`. It has **no** `question_type` and **no** `selected_option_labels`, whatever the question type. Options aren't checked against the question's list and there's no cap.
- Merge: `{ ...aiMap, ...existingMap }`. Existing entries win, so typed agent answers (`agent_runtime`) beat AI answers.
- Effect today: the per-script dashboard (`scriptSurveyAnalytics.ts`) reads only `selected_option_labels`, so AI-extracted choice answers from recordings don't show up as answered choice values. So the generic path does **not** already meet the requirement, and a change is needed.

### Change (generic path only)
- `buildGenericScriptPrompt`: each listed question also includes `max_selections` when set. Add instructions: for `multiple_select`, list every option the respondent mentioned; for `multiple_choice`, `yes_no` and grid rows, give exactly one option; use only the exact option strings. Questions with `is_internal: true` stay in the list, as they do today.
- New helper `normalizeGenericAiAnswer(q, a)`, built by looking up each AI entry's question by stable id (`q.id` or `q_idx_<i>`):
  - `multiple_select` → `question_type: 'multiple_select'`, `selected_option_labels` = AI options matched case-insensitively and trimmed to the question's `options` (stored with the canonical option text, no duplicates), then capped at a positive-integer `max_selections`.
  - `multiple_choice` (grid rows included) and `yes_no` → `selected_option_labels` = the first matching option only (`yes_no` matches Yes/No).
  - `scale` → `scale_value` when it's a number.
  - `open_ended`/other → `raw_text_answer` = `answer_text`.
  - Each entry also keeps `question_id`, `question_text`, `ai_hint`, `answered_at` and `source: 'ai_extraction'`, plus the legacy `answer_text`/`selected_options`/`scale_value` fields, so any existing reader still works.
  - An entry with no usable answer (no matching options, no number, no text) is skipped instead of being stored empty. Entries for unknown question ids are kept in today's legacy shape.
- Merge stays `{ ...aiMap, ...existingMap }`, so `agent_runtime` answers still win exactly as today.
- PE, audience and move-out paths, models, temperature, cost logging and status handling stay as they are.
- Limit: when a script has its own `ai_prompt`, the prompt wording is the script's. The normalization still applies to whatever it returns, as long as it uses the same `selected_options` keys.

## Report only (no change): `is_internal` questions
- `submit-public-script`: `totalQuestions` excludes `is_internal === true` (line ~413). `buildRawScriptAnswers` doesn't skip them, so any typed answer is saved.
- `process-research-record`: no question is skipped for `is_internal`. The generic prompt lists every question. The `is_internal` hits in this file are all the `api_costs` flag.
- `transcribe-call`: the survey-progress step sends every question and sets `total = questions.length`, so `is_internal` questions are counted. Its `is_internal` hits are the `api_costs` cost-audit filter only.

## Verification after build
- `deno check` on each of the 3 functions (pre-existing errors elsewhere are left alone).
- Deploy only these 3.
- Send an unsigned POST `{}` to each and expect today's answers: translate-script 401, submit-public-script 400 "token is required", process-research-record whatever it returns today (recorded before deploy and compared after).
- No real surveys, translations or record processing triggered.
