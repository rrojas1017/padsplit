# CR-007 (revised) — Link form and recording on lead_id + agent + time, with a phone cross-check

## Summary
The screen-pop form no longer carries a recording id. The recording and the form are linked by ViciDial `lead_id` + agent within a ±30-min window, with phone number as a fallback. If both phone numbers are present and differ, the two are never linked. On the recording upload, `recording_id` is used only to catch duplicates, plus an id-based link to legacy form rows whose phone matches.

This plan replaces the first CR-007, which is already deployed. It changes that code in place. It adds no database change, since all the columns it uses already exist.

## Changes

### 1. `supabase/functions/submit-conversation-audio/index.ts` (matched campaign only)
- Keep `callKey = cleanDialer(body.recordingId) ?? cleanDialer(body.uniqueid)` and `leadId = cleanDialer(body.leadId)`.
- Helper `phoneOk(row) = !(rowPhone10 && phone10 && rowPhone10 !== phone10)`.
- Type of `linked` becomes `'uid' | 'lead' | 'fallback' | null`. Remove the first CR-007 `idMismatch` flag, the `| id-mismatch` suffix and the `idMismatch` response field. The `!linked` guard in the booking-conflict path goes back to its original form.
- The linking section is restructured, replacing the current `if (callKey) … else if` pair:
  1. **Id step** (only if `callKey`): read `readByUid()`.
     - `kixie_link` set → `respondDuplicate` (unchanged).
     - `kixie_link` NULL and `phoneOk` → `linkRow = found; linked = 'uid'`.
     - Otherwise ignore the row and continue.
  2. **Form match** (if no `linkRow`): reuse the current window query (public rows, same campaign and `dialer_agent_user`, ±30 min) and add `dialer_call_id` to `RC_SELECT`. Then:
     - `pool = rows.filter(r => !r.kixie_link && phoneOk(r))`.
     - If `leadId`: `byLead = pool.filter(r => r.dialer_lead_id === leadId)`. If `byLead` is not empty, the candidates are `byLead` and `linked = 'lead'`.
     - Otherwise, if `phone10`: the candidates are the `pool` rows whose last 10 phone digits equal `phone10`, and `linked = 'fallback'`.
     - Exactly 1 candidate → `linkRow`.
     - More than 1 → suffix ` | unlinked (ambiguous)`.
     - 0 candidates while `rows` is not empty → ` | unlinked`.
     - If nothing links, reset `linked = null`.
  3. **No link**: insert a new row with `dialer_call_id: callKey` (if present), `dialer_lead_id`, and `dialer_agent_user`. If that hits a dialer-key conflict (`isDialerKeyConflict`), re-read the row by id. `kixie_link` set → duplicate. Otherwise retry the insert without `dialer_call_id` and log it.
- **Link update** (the existing guarded `.is('kixie_link', null)` update): also set `dialer_call_id: callKey` when `linkRow.dialer_call_id == null && callKey`. If the update fails with a dialer-key conflict, log `[cr007] dialer_call_id not set: conflict` and retry the same update without `dialer_call_id`. The `dialer_lead_id` fill stays as it is today. `patchLinkedBooking` is unchanged.
- The response `linked` uses the new union. The shape is otherwise the same as before the first CR-007.

### 2. `supabase/functions/submit-public-script/index.ts` (`createNew` only)
- **Legacy uid path:** unchanged from the current code. It already adopts with the phone cross-check and does `insertUnlinked(outcome, true)` on a mismatch.
- **New recording-first path**, when there is no `dialerUid` and both `dialerLead` and `dialerAgent` are present:
  - query `research_calls` with `DIALER_SELECT`, filtered to `campaign_id = campaign.id`, `caller_type <> 'public'`, `dialer_agent_user = dialerAgent`, `dialer_lead_id = dialerLead`, `created_at >= now - 2h`, and `responses->>_submission_id` IS NULL, limit 10;
  - filter out rows where `phoneMismatch(d)` is true;
  - exactly 1 → `adopt(d, outcome)`. This keeps the existing conditional update; `kixie_link` is untouched, and `finishNew(..., linked=true)` runs;
  - 0 or several → the current plain `insertRow(outcome, false)` with the dialer fields.
- Everything else is unchanged: BUG-005 save model, merge rules, corrective #2, CR-006 guard.

### 3. `src/pages/research/ScriptBuilder.tsx`
- `SCREEN_POP_QUERY` = `?lead=--A--lead_id--B--&phone=--A--phone_number--B--&agent=--A--user--B--&campaign=--A--campaign--B--`.
- Help line: "In the recording POST send the call's lead_id as `leadId` and its recording_id as `recordingId`."

### 4. `src/pages/ApiDocs.tsx` (submit-conversation-audio)
- Param rows:
  - `leadId`: ViciDial lead_id, the link key to the screen-pop form, max 64.
  - `recordingId`: ViciDial recording_id, the duplicate-protection key, max 64.
  - `uniqueid`: legacy alias of `recordingId`.
- Linking text: the recording matches on lead + agent within ±30 min, else phone + agent. A different phone never links, and ambiguous matches are not linked. `linked` is `"uid" | "lead" | "fallback" | null`. A repeat `recordingId` returns the 200 duplicate. The `idMismatch` mention is removed.
- Screen-pop URL example without `uid`.

## Not changed
`PublicScriptView.tsx`, credential auth and rate limit, `campaign_key` resolution, the recording host allow-list, BUG-005..008, the duplicate response, existing rows, the database, types.ts, dependencies.

## Verification
- `tsgo --noEmit -p tsconfig.app.json`; `deno check` for both functions.
- Deploy both functions. Unsigned POST `{}` should give 401 for submit-conversation-audio and 400 "token is required" for submit-public-script.
- No test surveys or recordings; QA proves it live. Nothing published.
