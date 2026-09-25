# CR-007 corrective #1 — Match the recording against the form's open interval

One file only: `supabase/functions/submit-conversation-audio/index.ts`, form-match step (step 2, which runs only when the id step did not set `linkRow`).

## Changes

1. **`RC_SELECT`** becomes
   `'id, kixie_link, caller_phone, dialer_lead_id, dialer_agent_user, dialer_call_id, created_at, call_outcome, finalized_at:responses->>_finalized_at'`.
   `readByUid` also uses `RC_SELECT`; the extra columns there are harmless.

2. **Candidate query** (replaces the ±30-min query):
   - public rows, same `campaign_id`, same `dialer_agent_user`, `kixie_link` IS NULL (`.is('kixie_link', null)`);
   - `created_at` from `callStart − 3 h` to `callStart + 90 min`;
   - limit 50.

3. **Interval helper** `inInterval(r, beforeMin, afterMin)`:
   - `formStart = Date.parse(r.created_at)`;
   - `formEnd = r.finalized_at ? Date.parse(r.finalized_at) : Date.now()`; if the finalized time does not parse, use `Date.now()`;
   - true when `formStart − beforeMin ≤ callStartMs ≤ formEnd + afterMin`.

4. **Lead match** (when `leadId` is present):
   - `byLead = rows.filter(r => r.dialer_lead_id === leadId && phoneOk(r) && inInterval(r, 120, 30))`;
   - if `byLead.length > 0`, then `kind = 'lead'` and the candidates are `byLead`.

5. **Phone fallback** (when there is no lead candidate and `phone10` is set):
   - candidates are the rows where `inInterval(r, 60, 15)`, `phoneOk(r)`, and the row's last 10 phone digits equal `phone10`;
   - `kind = 'fallback'`.

6. **Decision** (existing rules kept):
   - Exactly 1 candidate → `linkRow`, `linked = kind`.
   - More than 1 → ` | unlinked (ambiguous)`.
   - 0, but some row passes `inInterval(r, 60, 15)` → ` | unlinked`.

7. **Log**, exactly once per form-match run: `[cr007] match kind=<lead|fallback|none> candidates=<n>`. `kind=none` covers the case where nothing links, including ambiguous matches. No phone numbers, ids or lead values are logged.

## Not changed
The id step (duplicate check and legacy uid link with `phoneOk`); the no-link insert with `recordingId`; setting `dialer_call_id` on link; the guarded link update and `patchLinkedBooking`; the response shape; the CR-006 guard; credential auth and rate limit; any other file; the database; dependencies.

## Verification
- `deno check` for submit-conversation-audio.
- Deploy submit-conversation-audio; an unsigned POST `{}` should give 401 as before.
- No recordings submitted. Nothing published.
