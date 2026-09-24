# PIPE-2 — Reanalyze parity + Kixie webhook cleanup

Files changed: `reanalyze-call/index.ts` and `receive-kixie-webhook/index.ts` only. **transcribe-call is not touched**: PIPE-1 already returns 400 for `callId` without `bookingId` (L2528-2529, message `'callId is not supported; send bookingId'`).

Auth stays exactly as today. reanalyze-call uses `requireUserOrInternal(req, MANAGERS)` at L753 (not `requireUser`); that line is left as is. The Kixie secret check is left as is. No migrations, RLS, config.toml or frontend changes. Not published.

## 1) reanalyze-call/index.ts

**a) Weights (L109-110):** change `deepseekSettings?.weight || 0` to `?? 0`, and `geminiSettings?.weight || 100` to `?? 100`.

**b) DeepSeek model and fallback**
- L135, L142, L176, L202: `'deepseek-chat'` becomes `'deepseek-v4-flash'`.
- L593-631 (DeepSeek branch in `callAIWithRetry`):
  - Wrap the DeepSeek call and its cost log in try/catch.
  - On error: log `'[LLM] DeepSeek failed, falling back to Gemini:'` with the error message only.
  - Set a local `providerUsed = 'lovable_ai'` and run the existing Gemini request (L632-677). It is moved into a small inner `runGemini(model, fallbackReason)` helper, called with the duration-based model and `'deepseek_error'`.
- A DeepSeek reply that isn't valid JSON (L680-693) also falls back to Gemini once, in the same attempt.
- The returned `llmProvider` and cost rows carry the provider and model actually used.

**c) Company knowledge (L270-296, `fetchCallTypeConfig`)**
- With a call type: L292 `.contains(...)` becomes `.or(\`call_type_ids.is.null,call_type_ids.cs.{${callTypeId}}\`)`.
- Without a call type: a new `fetchGlobalKnowledge(supabase)` loads only `call_type_ids IS NULL` rows (active, ordered by priority), copied from transcribe-call L961-980.
- `buildDefaultAnalysisPrompt` gains a `globalKnowledge` parameter and appends it the same way transcribe-call does (L987-1000). Today there are 0 such rows, so the prompt is unchanged in practice.

**d) Non-Booking buyer intent**
- `buildDynamicAnalysisPrompt(transcription, config, isNonBooking = false, globalKnowledge = [])` and `buildDefaultAnalysisPrompt(transcription, isNonBooking = false, globalKnowledge = [])`.
- When `isNonBooking`, add to the JSON schema the `"buyerIntent": {...}` block and the buyer-intent scoring guide, copied verbatim from transcribe-call L1115-1130 / L1170-1190 (dynamic) and L1235-1250 / L1295-1315 (default).
- `callAIWithRetry` works out `isNonBooking = bookingStatus === 'Non Booking'` and passes it (L587).
- `keyPoints` (L710-720) adds `...(isNonBooking && parsed.buyerIntent ? { buyerIntent: parsed.buyerIntent } : {})`.
- In the handler, the L806 select becomes `call_transcription, call_key_points, qa_scores`.
- Before the update (L837): for a Non-Booking call where the new keyPoints lack `buyerIntent` but the old `call_key_points.buyerIntent` exists, copy it over. The overwrite then keeps it.

**e) QA scoring after reanalysis**
- L787 select adds `record_type`.
- After a successful update (after L851): if `booking.record_type !== 'research'` and the old `qa_scores` is null, await a POST to `${supabaseUrl}/functions/v1/generate-qa-scores` with body `{bookingId}`. It uses the same internal auth transcribe-call uses for downstream calls (L2287-2293): `Authorization: Bearer <service role>`, which the shared `checkInternal` accepts.
- A non-2xx response or exception is logged (status only) and never fails the reanalysis. The response shape is unchanged.

## 2) receive-kixie-webhook/index.ts
- L205-231: delete the fire-and-forget `fetch(.../transcribe-call)` block and its skipTts/Vixicom lines. The `calls` insert and the settings checks stay. The eligibility log is kept, and says transcription is not wired.
- L237-245 response: `transcriptionTriggered: false`, `reason: 'calls pipeline not wired to transcription'`. All other fields are unchanged.
- The secret check (fail-closed + timingSafeEqual) is untouched.

## Verification
- `deno check` on both functions. Pre-existing warnings are reported separately.
- Deploy `reanalyze-call` and `receive-kixie-webhook`.
- POST to reanalyze-call with the anon key as bearer: expect 401.
- POST to the Kixie webhook without a secret: expect the same 401/403 as today (403).
- No real reanalysis is run.
