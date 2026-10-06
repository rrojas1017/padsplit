# CR-012 (backend, 1 of 2) — Call close outcomes per script

## Files touched (exactly three)
1. `supabase/functions/validate-script-token/index.ts`
2. `supabase/functions/submit-public-script/index.ts`
3. NEW `supabase/migrations/20261006200000_capture_cr012_call_outcomes.sql` — written as a plain file, never executed

Nothing under `src/`, no other function, no `_shared/*`, no `config.toml`, no RLS, no migration tool, no `types.ts`. Deploy only these two functions. Nothing published.

## 1. validate-script-token
- Add `call_outcomes` to the `research_scripts` select (line 69).
- New local pure helper `sanitizeOutcomes(v)`: if not an array, return `[]`. For each item: keep only if it is an object, `id` is a string with trimmed length 1–64, and `label` is a string non-empty after trim. Output `{ id, label: label.trim().slice(0,80) }`, plus `label_es` (trimmed, cut to 80) only when it is a non-empty string. Stop at 20 items.
- Return `call_outcomes: sanitizeOutcomes(script.call_outcomes)` inside `script`. Nothing else changes.

## 2. submit-public-script

### 2a. Inputs and lookup
- Destructure two new optional body fields: `close_outcome_id`, `outcome_only`. Never logged.
- Script select (line 287) becomes `'id, questions, questions_es, is_active, slug, call_outcomes'`.
- `resolveOutcome(id)`: returns null unless `id` is a string of length 1–64 that matches an item `id` in `script.call_outcomes` (an array; malformed items ignored). Returns `{ id, label }`, where label is that item's English `label`, trimmed and cut to 120. If the label is empty after trimming, it returns null. A label sent by the client is never read.
- `const closeOutcome = resolveOutcome(close_outcome_id)` is computed once. Old clients send no id, so it is null and every path stays as today.

### 2b. outcome_only branch
Runs right after the "script is not active" check (line 299), before question normalization, campaign resolution, the rate limiter, `readRow`/`createNew`/`handleTerminal`/`finalizeSideEffects`. Runs only when `outcome_only === true`:
1. No valid `submission_id` → 400 `{error:'submission_id is required'}`.
2. Read `id, call_outcome, created_at, responses` from `research_calls` where `responses->>_submission_id = submissionId` (limit 1). No row → 404 `{error:'Submission not found'}`.
3. `responses._token_id !== tokenRow.id` → 403 `{error:'Submission belongs to another link'}`.
4. `call_outcome === 'in_progress'` → 409 `{error:'Submission not finalized'}`.
5. Reference time = `responses._finalized_at` if it parses, else `created_at`. If more than 6 h have passed → 409 `{error:'Submission expired'}`.
6. `closeOutcome` null → 400 `{error:'Unknown outcome'}`.
7. `UPDATE research_calls SET close_outcome_id, close_outcome_label WHERE id = row.id`, setting those two columns only. If it errors → 500 `{error:'Failed to record outcome'}` (logs the error message only).
8. Fire-and-forget token touch (same as `ok`), then 200 `{ ok:true, research_call_id, status: row.call_outcome, close_outcome:{id,label} }`.

The checks run in the ticket's order: 404 → 403 → 409 not finalized → 409 expired → 400 unknown. The branch never creates a row and doesn't touch bookings, transcriptions, script_responses or AI processing.

### 2c. Terminal writes carry the outcome
- `outcomeCols(outcome)`: when `outcome !== 'in_progress'` and `closeOutcome` is set, returns `{ close_outcome_id, close_outcome_label }`. Otherwise it returns `{}`.
- These are spread into:
  - `insertRow` (covers legacy insert, new-submission insert and `insertUnlinked`);
  - the `adopt` update;
  - `updateFields(outcome)`, which is used by the in_progress → terminal flip. In-progress saves pass 'in_progress', so they get nothing.
- Early disposition: `effectiveDisposition = (endedEarly && closeOutcome) ? closeOutcome.label : earlyDisposition`. It replaces `earlyDisposition` in `buildEnriched` (`_early_disposition`) and in `currentOpts` (`disposition`, which feeds `survey_progress.disposition`). When the outcome doesn't resolve, the value is exactly today's.
- `handleTerminal` is not changed. A repeated terminal save never writes the outcome columns. It still reads the stored `_early_disposition` for repair, as today.

### 2d. Response
- `ok(...)` gets `close_outcome`, set by a request-local `writtenOutcome` (default null). Paths that actually wrote a terminal outcome set it to `closeOutcome`: `finishNew` with a terminal outcome, and a successful flip. In-progress saves, stale saves and `handleTerminal` replies return `close_outcome: null`. Every other field is unchanged.
- Old clients get the same behaviour and the same row writes. The only difference is the extra `close_outcome: null` key in the 200 response, which the ticket asks for.

### Unchanged
BUG-005 save model (submission_id, save_seq stale rejection, immutable terminal rows, 6 h in-progress expiry, token ownership), the 120 s repair guard, CR-005/007/009 adopt and phone cross-check, `dialer_*` cleaning, UNIQUE keys, one booking per call, the `process-research-record` re-trigger, the rate limiter, and the `call_outcome` values. Nothing new is logged.

## 3. Capture file
Header comment line `-- Capture only — applied by direct SQL on 2026-10-06 (drift #52). Do not run.`, then the four statements exactly as given, with a trailing newline. I'll report `wc -l` and `md5sum`.

## Verification
- `deno check` on both functions.
- Deploy both.
- `validate-script-token` POST `{}` → 400 "Token is required". `submit-public-script` POST `{}` → 400 "token is required". POST `{token:'fake', outcome_only:true, submission_id:'x'}` → 403 (invalid token).
- No real submissions or outcome updates are sent, because they would write real research rows.
