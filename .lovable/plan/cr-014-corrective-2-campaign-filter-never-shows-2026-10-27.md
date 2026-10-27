# CR-014 corrective #2 — Campaign filter never shows

## Change (one file: `src/hooks/useScriptSurveyResponses.ts`)
1. Campaign-map select (line 103): replace `research_calls(campaign_id)` with `research_calls!bookings_research_call_id_fkey(campaign_id)`. The row shape stays `bookings.research_calls.campaign_id`, so the reader at line 124 is unchanged.
2. When a campaign read fails, log once: `console.warn('[script-survey] campaign map unavailable', code)`. `code` is only the PostgREST error code (for example `PGRST201`), or `'unknown'` if there is none. No data, rows or messages are logged. This covers:
   - campaign-map promise rejected → code from `mapRes.reason?.code`
   - `research_campaigns` read returns an error → code from `ce.code`, logged with the same message
3. The error rules stay as they are: a failed campaign read gives an empty map / `[]` with `campaignIdsReadable = false`, and a failed records read still throws.

## Other `research_calls(` embeds from `bookings`
Searched `src/` and `supabase/functions/`: the only match is this hook (line 103). Nothing else to list or change.

## Acceptance
- `tsgo --noEmit -p tsconfig.app.json` clean.
- Admins see the Campaign picker on Non-Booking Conversion (two campaigns). This is checked in the browser if a session is available; otherwise it is reported as unverified.
- Nothing published. No functions, database or RLS changes.
