# BIL-COSTS — one shared price list for all cost logging

Scope: `supabase/functions/**` only. Request/response shapes, auth guards and behaviour stay the same; only how costs are worked out and saved changes. Cost logging never throws. Nothing is published, and no paid calls are made.

## 1. New `supabase/functions/_shared/costs.ts`
- `PRICES` (USD, as of 2026-09-23):
  - `llm` per 1M tokens: gemini-2.5-pro 1.25/10 (2.50/15 when prompt tokens > 200,000), gemini-2.5-flash 0.30/2.50, gemini-2.5-flash-lite 0.10/0.40, gemini-3-flash-preview 0.50/3.00, openai/gpt-5 1.25/10, deepseek-v4-flash and deepseek-chat 0.30/1.20.
  - `stt_per_minute`: deepgram_nova2 0.0043, deepgram_nova3 0.0043, elevenlabs_scribe 0.22/60.
  - `tts_per_char`: eleven_turbo_v2 0.00005, eleven_flash_v2_5 0.00005, eleven_multilingual_v2 0.0001.
- `llmCost(model, inTok, outTok)`: exact key match first, then match on the part after `/`. An unknown model is priced as gemini-2.5-pro, so it is never 0. Gateway (non-DeepSeek) costs are multiplied by `Number(Deno.env.get('GATEWAY_MULTIPLIER') ?? '1')`. If that value is not a number, the multiplier falls back to 1.
- `tokensFromUsage(json, promptText, outText)`: returns `{inputTokens, outputTokens, source}`. It uses `usage.prompt_tokens` / `completion_tokens` when present (`source: 'usage'`), otherwise characters ÷ 4 (`source: 'estimate'`).
- `sttCost(model, seconds)` and `ttsCost(model, chars)` pick a price by model. The STT fallback is ElevenLabs Scribe for provider elevenlabs and Nova-2 for deepgram. The TTS fallback is eleven_turbo_v2.
- `logApiCost(admin, row)`:
  - Works out `estimated_cost_usd` from model + tokens, audio seconds, or characters.
  - Saves `model` and `token_source` into `metadata`, keeping any metadata already there.
  - Waits for the insert into `api_costs`, using the same column names as today.
  - Limits `service_provider` to `elevenlabs | lovable_ai | deepgram | deepseek`.
  - Wraps everything in try/catch and only logs the error message. It never logs prompts, transcripts or personal data.

**Sanity check:** gemini-2.5-flash with 1,130,702 input and 298,000 output tokens works out as 0.339211 + 0.745000 = **$1.084211, which rounds to $1.0842**, not $1.0843. At these prices, $1.0843 would need about 333 more input tokens. I will add a check that `llmCost` returns 1.084211 (±0.00001) and report the result. Tell me if the prices or the expected figure should change.

## 2. Functions switched to the shared module
The same `service_type`, `edge_function`, `booking_id`, `agent_id`, `site_id`, `triggered_by_user_id` and `is_internal` values as today. Every call waits for the cost to be saved. Where the AI's JSON reply is available, tokens come from `tokensFromUsage`.

| Function | Delete (local cost code) | Call sites to update |
|---|---|---|
| transcribe-call | STT_PRICING ~214-219, DEEPSEEK_PRICING 230-234, logApiCost 385-458; token math 370-371, 641-659 | 1681, 1721, 1756, 1813-1817, 1859, 2061-2069 |
| reanalyze-call | DEEPSEEK_PRICING 55-59, logApiCost 210-263; token math 195-196, 710-711 | 715, 764 |
| process-research-record | logApiCost 6-39; token math 74-75 | 1166, 1220, 1268, 1329, 1361, 1379 |
| generate-research-insights | logApiCost 10-42; token math 731-732 | 834, 846, 929 |
| generate-coaching-audio | logApiCost 7-69; estimates 316-317 | 318 (LLM), 427 (TTS) |
| generate-qa-coaching-audio | logApiCost 8-70; estimates 361-362 | 363 (LLM), 472 (TTS) |
| generate-qa-scores | logApiCost 22-62; estimates 190-191 | 192 |
| batch-generate-qa-scores | logApiCost 13-63; estimates 185-186 | 187 |
| analyze-member-insights | logApiCost 45-94; estimates 782-783 | 810 |
| analyze-non-booking-insights | inline rates 390-397 and 453-460 (both inserts) | same two places, including the parse_failed row |

transcribe-call details:
- The internal helpers that call DeepSeek or the gateway return the raw `usage` numbers they already read (lines 370-371). This is not visible from outside the function.
- STT, polish/summary, and survey calls each already write their own row; TTS is not written from this function.
- If any call site turns out to combine STT and TTS, it will be split into separate rows.
- The per-record cost ceiling (lines 2399-2505) is untouched; it reads the rows this writes.

## 3. Still using their own cost math (not changed now)
- `batch-generate-qa-coaching` (own logApiCost, lines 10-42)
- `compare-llm-providers` (DEEPSEEK/GEMINI_PRICING, lines 11-24; inserts at 333, 345)
- `reclassify-records` (inline flash rate, line 259)

## Verification
- `deno check` on every changed function.
- Deploy all 10 functions.
- Anonymous `POST {}` to each, expecting 401.
- Offline `llmCost` sanity check, with no network calls.
- Report the results. You run the first real paid call.

## Technical notes
- There is one real change in how records are costed: missing `usage` with a zero value is now treated as present (the current `||` swaps a real 0 for an estimate).
- `metadata.model` stays as the full gateway id (for example `google/gemini-2.5-flash`).
- Prices apply only to new rows; existing `api_costs` rows are not recalculated.
