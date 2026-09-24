# P-B — Public script submissions (3 files only)

Files: `src/pages/PublicScriptView.tsx`, `supabase/functions/submit-public-script/index.ts`, `supabase/functions/validate-script-token/index.ts`. Nothing else (no migrations, RLS, config.toml, other functions). Not published.

## Backward compatibility rule
The live site sends responses keyed by sorted index, no `submission_id`, no `declined`. The server tells the two apart by `submission_id`:
- **No `submission_id` (old client):** keep today's key logic exactly (index first, then stable id). No idempotency.
- **With `submission_id` (new client):** keys are stable ids; lookup is stable id first, then `String(q.id)`, then index.

Numeric ids (1, 2, ...) could collide with index keys "0", "1", so the mode switch is needed.

## 1) validate-script-token/index.ts
- L69 select: add `questions_es, intro_script_es, closing_script_es, rebuttal_script_es, translation_status`.
- After L79 (script found): if `script.is_active === false` return 200 `{valid:false, error:'This script is no longer active'}`.
- L88 log: drop the script name → `'Script token validated'`. No token or IP logged anywhere.
- L93-103 response `script`: add the 5 new fields (existing fields unchanged).
- Token checks L31-64 unchanged.

## 2) submit-public-script/index.ts
- **L113-122 body read:** read `await req.text()` once; if byte length > 100,000 → 413 `{error:'Payload too large'}`; then `JSON.parse` (bad JSON → `{}` as today, which then hits the existing "token is required" 400).
- **L123-133 destructure:** add optional `declined`, `submission_id` (accepted only if string ≤ 100 chars, else ignored).
- **After L139 (token present), before token lookup:** abuse checks on `responses`: > 200 keys → 400 `{error:'Too many responses'}`; any string (walked recursively in responses, probeNotes, agentNotes) > 5,000 chars → 400 `{error:'Response too long'}`.
- **L142-163 token validation:** unchanged — invalid token still returns 403 `{error:'Invalid or revoked token'}`.
- **L166-176 script:** select adds `is_active`; if `is_active === false` → 409 `{error:'Script is not active'}`.
- **L182-189 normalization:** branch on `submission_id` as described above.
- **L41-109 buildRawScriptAnswers, yes_no case (L83-90):** `typeof answer === 'boolean'` → 'Yes'/'No', else existing string logic.
- **L195-201 campaign:** first query `status='active'` ordered by created_at desc; if none, today's most-recent query. No campaign → existing 400.
- **New, before insert:** 
  - `clientHash` = SHA-256 hex of (first `x-forwarded-for` IP, trimmed, or '' ) + `SUPABASE_URL`. Never logged.
  - Idempotency (only when `submission_id`): select `id` from research_calls where `campaign_id = campaign.id` and `responses->>_submission_id = submission_id` limit 1; if found → 200 `{ok:true, research_call_id, booking_id: (linked booking id or null), raw_answers_count}`.
  - Rate limits: count research_calls where `responses->>_token_id = tokenRow.id` and created_at ≥ now−1h; ≥ 60 → 429 `{error:'Too many submissions, try again later'}`. Count where `responses->>_client_hash = clientHash` and created_at ≥ now−10 min; ≥ 10 → 429 (same). Skipped for the client-hash check when no IP header.
- **L210-216 enrichedResponses:** add `_token_id`, `_client_hash`, `_submission_id` (null when absent).
- **L227 call_outcome:** `declined ? 'refused' : endedEarly ? 'ended_early' : (answered count === 0 ? 'refused' : 'completed')`. `caller_type: 'public'` kept.
- **L244-281 booking + transcription:** wrapped in `if (callOutcome === 'completed')` (otherwise bookingId stays null).
- **New after booking block (completed only, try/catch, non-fatal, logs without token):** insert one `script_responses` row per entry in rawScriptAnswers: `{script_id, session_id: research_call_id, question_order: question.order ?? index, response_value (text / label(s) joined ", " / String(scale)), response_options (selected labels or null), response_numeric (scale value or null), respondent_id: null, metadata:{question_id, question_type, source:'public_script', language, token_id}}`. Then read `total_responses` and update `total_responses + 1`, `last_response_at = now()` on research_scripts.
- Response JSON L289-296 unchanged `{ok, research_call_id, booking_id, raw_answers_count}`.
- L149 log keeps only the DB error (no token).

## 3) PublicScriptView.tsx
- **State (near L122):** `declined` (bool), `submissionId` (string | null).
- **Begin Script handler (~L450):** `setSubmissionId(crypto.randomUUID())` when the run starts.
- **Stable keys:** helper `stableKeyFor(q)` = `q.id` if present, else `q_idx_<index of q in the original script.questions>` (index found by `order`/position match; for translated questions, same position in `questions_es`). `responses` becomes `Record<string, unknown>`; setters at L534/581/604/617 and reads at L260 (branching) and L309 (`currentResponse`) use `stableKeyFor(currentQ)`. Probe-note keys stay as today.
- **handleConsent (L242-251):** "No" → `setDeclined(true)` before rebuttal/done.
- **submitPublic (L159-185):** body adds `declined`, `submission_id: submissionId`. Guard allows re-run from `'failed'` (Retry) with the same `submissionId`. Auto-submit effect (L188-192) unchanged.
- **Done card (L685-709):** status line: saving → "Saving…", saved → "Saved", failed → "Could not save" + **Retry** button calling `submitPublic` again (same `submission_id`; passes `endedEarly/earlyDisposition` when relevant).
- **restart (L195-208):** reset `declined` and `submissionId`.
- **Spanish (L429-448):** existing branch now works because validate returns `questions_es` + `translation_status`; the translate-script fallback only runs when translation isn't completed.

## Verification
- `npx tsgo --noEmit -p tsconfig.app.json`; `deno check` both functions (pre-existing warnings reported separately).
- Deploy `submit-public-script`, `validate-script-token`.
- Anon POST to submit-public-script with an invalid token → still 403 `{error:'Invalid or revoked token'}`; validate-script-token with an invalid token → `{valid:false, error:'Invalid token'}`.
- Not tested from here: a full real public submission (would write live data) — manual check.
