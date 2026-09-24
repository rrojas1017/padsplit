# PIPE-1 — Transcription pipeline fixes (3 edge functions only)

Scope: check-auto-transcription, transcribe-call, batch-retry-transcriptions. Auth guards unchanged; request/response fields unchanged (only additions); prompt wording, pricing constants, config.toml, schema and RLS untouched. Service-to-service calls keep the service-role bearer. No secrets logged.

## 1. check-auto-transcription/index.ts
(a) Move the rules block (lines 115-185: fetch active `transcription_auto_rules`, match agent > call_type > site > global, `auto_transcribe` check) so it runs before the claim block (lines 84-113). Result order: kixie checks → rules (same `triggered:false` reasons: `Error fetching rules`, `No rules configured`, `No matching rule`, `Auto-transcribe disabled for this rule`) → claim RPC → dispatch. A booking is only set to 'queued' when a rule matched with `auto_transcribe = true`.
(b) Lines 207-213 (`!transcribeResponse.ok`): if `status !== 409`, run `update({ transcription_status: 'failed', transcription_error_message: 'Dispatch failed: <status>' }).eq('id', bookingId).eq('transcription_status', 'queued')` (try/catch, logged), then return the same `triggered:false` response. A 409 (already processing) leaves the booking alone.

## 2. transcribe-call/index.ts
(a) Serve handler: move the env-var check (lines 2539-2550: at least one of ELEVENLABS_API_KEY / DEEPGRAM_API_KEY, plus LOVABLE_API_KEY) above the recording lookup and claim (before line 2476). Same error message and same 400 response from the existing catch.
(b) Serve handler line 2472: read `callId` too. If `callId` is set and `bookingId` is missing → 400 `{success:false, error:'callId is not supported; send bookingId'}`, before the existing `Missing bookingId` check.
(c) selectLLMProvider lines 284-285: `deepseekSettings?.weight ?? 0` and `geminiSettings?.weight ?? 100`.
(d) Replace all 3 `'deepseek-chat'` (lines 310, 317, 351) and the fallback on line 377 with `'deepseek-v4-flash'`. DeepSeek branch (lines 1751-1786): wrap the DeepSeek call in try/catch. It counts as failed if the call throws, returns non-2xx, or its content doesn't parse as JSON (after the same code-fence stripping used later). On failure, log `[LLM] DeepSeek failed, falling back to Gemini`, set a local `llmProviderUsed = 'lovable_ai'`, and run the existing Gemini request and cost-log block (lines 1787-1830), moved into a local helper so both paths use the same code. Model: the Gemini model the selector would pick for this call's duration (the existing duration-based selection, reused, not duplicated). The DeepSeek cost row is only written on success. Line 2071 `llm_provider: llmSelection.provider` becomes `llm_provider: llmProviderUsed` (defaults to `llmSelection.provider`).
(e) processTranscription line 1510: after `siteId = ...`, add `agentId = bookingData?.agent_id || null;`.
(f) Line 2015: `campaignName` is undeclared. Replace with `campaign: campaignId || 'unknown'` if `campaignId` (declared at line 1937) is in scope at that point, otherwise the literal `'unknown'`.
(g) fetchCallTypeConfig lines 907-912: `.contains('call_type_ids', [callTypeId])` becomes `.or(\`call_type_ids.is.null,call_type_ids.cs.{${callTypeId}}\`)`. When there is no call_type_id: a new small helper `fetchGlobalKnowledge(supabase)` selects active rows with `call_type_ids IS NULL`, ordered by priority. `buildDynamicPrompt` (line 962) gets an optional `globalKnowledge` argument. On the `!config` path, when there is at least one row, it appends a "Company knowledge" section to the default prompt. With 0 rows (today) the prompt is byte-identical. Called at line 1516/1741.

## 3. batch-retry-transcriptions/index.ts
- Main select (lines 376-386): add `updated_at`; `FailedBooking` type (~line 19) gets `updated_at?: string`.
- Stuck filter line 437: `(b.updated_at || '') < tenMinutesAgo`.
- All 4 resets to 'pending' (lines ~131-137, 280, 330, ~484-490) gain `.or('transcription_status.is.null,transcription_status.in.(failed,pending,queued)')` so 'processing' and 'completed' are never overwritten. Anything else in these branches stays the same.

## Verification
`deno check` on all 3 (existing warnings in transcribe-call listed separately from new ones), deploy all 3, anon-key POST `{}` to each (expected 401).
