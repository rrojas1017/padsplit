# CR-014 corrective — run the campaign reads alongside the records read

One file: `src/hooks/useScriptSurveyResponses.ts`. Frontend only, nothing published.

## Change
- After the script row loads, start all three reads together:
  1. the records fetch (paged, unchanged query),
  2. the campaign-map fetch (paged `booking_transcriptions` → `research_calls.campaign_id`),
  3. the `research_campaigns` read for this script.
- Use `Promise.allSettled`:
  - If the records fetch is rejected, throw its error exactly as today.
  - If the campaign-map fetch is rejected, or every id comes back empty: empty map and `campaignIdsReadable = false`.
  - If the campaigns read is rejected or returns an error: `campaigns = []`.
- Record mapping, returned shape, filters and ordering stay the same.

## Acceptance
- `tsgo --noEmit -p tsconfig.app.json` clean.
- A failed or denied campaign read never fails the records query. A failed records query still throws.
- Nothing published.
