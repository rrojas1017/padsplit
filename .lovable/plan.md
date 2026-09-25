# CR-007 Corrective #1b — Restore RC_SELECT fields

## Problem
`RC_SELECT` in `supabase/functions/submit-conversation-audio/index.ts` (line 228) is still the pre-corrective-#1 value:

```ts
const RC_SELECT = 'id, kixie_link, caller_phone, dialer_lead_id, dialer_agent_user, dialer_call_id';
```

The corrective-#1 form-matching code reads `r.created_at`, `r.call_outcome`, and `r.finalized_at` from each candidate row, but those columns are not selected. As a result `r.created_at` is `undefined`, `Date.parse(undefined)` is `NaN`, and `inInterval` always returns `false` for every row — so **no recording can link to a form (lead or phone), live in production**.

## Change (one line, one file)
Set `RC_SELECT` to include the three missing fields:

```ts
const RC_SELECT = 'id, kixie_link, caller_phone, dialer_lead_id, dialer_agent_user, dialer_call_id, created_at, call_outcome, finalized_at:responses->>_finalized_at';
```

Nothing else changes. No other file, no database, no migration.

## Verification
1. `deno check supabase/functions/submit-conversation-audio/index.ts` — clean (no new errors beyond pre-existing).
2. Deploy `submit-conversation-audio`.
3. Unsigned `POST {}` returns `401` as before.

Final `RC_SELECT` line will be shown in the reply. Nothing published.
