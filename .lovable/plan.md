# BIL-COSTS correction: DeepSeek model alias

Only `supabase/functions/_shared/costs.ts` changes. Cost calculation is the only thing that changes, and it never throws. Nothing is published, and no paid calls are made.

## Defect
DeepSeek's reply gives the model as `deepseek-flash`. That name matches no key in the price list, so the row is priced as gemini-2.5-pro. Booking 090a5ef6 (2,518 in / 3,083 out) was logged at $0.033977; the correct cost is $0.004455.

## Changes in costs.ts
1. **Line 17 (after `deepseek-chat`):** add `'deepseek-flash': { in: 0.30, out: 1.20 },`.
2. **`findLlmPrice`, lines 38-48:** if no exact or short-name match is found and the model name (lowercased) starts with `deepseek`, return the `deepseek-v4-flash` price instead of the Pro fallback.
3. **`llmCost`, lines 51-60:** add an optional 4th argument, `providerHint?: string`, passed on to `findLlmPrice`. When the hint is `'deepseek'` and nothing matches, the `deepseek-v4-flash` price is used. Existing 3-argument calls behave as today, except for the DeepSeek fallback above. DeepSeek prices still skip the gateway multiplier (line 59 already checks for keys starting with `deepseek`).
4. **`computeCost`, lines 119-121:** pass `row.service_provider` as the hint. A DeepSeek row with an unknown or missing model can then never fall back to the Pro price.

## Offline check (no network)
- `llmCost('google/gemini-2.5-flash', 1130702, 298000)` = 1.084211 (existing check)
- `llmCost('deepseek-flash', 2518, 3083)` = 0.0044550
- `llmCost('deepseek-something-new', 1e6, 0)` = 0.30
- `computeCost({service_provider:'deepseek', model:'mystery', input_tokens:1e6, ...})` = 0.30
- `llmCost('foo', 1e6, 0)` still uses the Pro price (2.50, because it is over 200k tokens)

## After approval
- Run `deno check` on the 10 functions that import costs.ts. Two of them, transcribe-call and generate-research-insights, will still show the 7 errors reported last time; those are in code these changes don't touch.
- Redeploy the same 10: transcribe-call, reanalyze-call, process-research-record, generate-research-insights, generate-coaching-audio, generate-qa-coaching-audio, generate-qa-scores, batch-generate-qa-scores, analyze-member-insights, analyze-non-booking-insights.
- Send an unsigned POST {} to each, expecting 401.
- Report the results.
- The existing wrongly priced row for booking 090a5ef6 is not corrected; this change only affects future rows.
