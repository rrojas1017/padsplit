# CR-007 — Link on ViciDial recording_id, refuse id link on phone mismatch

## Summary
The recording POST and screen-pop form now share ViciDial's `recording_id` (sent as `recordingId` in the POST, as `uid` in the pop). Whenever an id match's phone number disagrees with the incoming phone, the id link is refused and a separate, unlinked record is created. Column `research_calls.dialer_call_id` and its per-campaign unique key are unchanged.

## Changes

### 1. `supabase/functions/submit-conversation-audio/index.ts`
- Line ~218: `const callKey = cleanDialer(body.recordingId) ?? cleanDialer(body.uniqueid);` replaces `uniqueid`. It is used in `readByUid` (`.eq('dialer_call_id', callKey)`), the `if (matchedCampaignId && callKey)` branch and the insert `dialer_call_id: callKey`. The CR-006 guard applies to both inputs through `cleanDialer`. `leadId` is unchanged.
- New local flag `idMismatch = false`.
- Inside `if (found)` (lines ~272–276), the order is:
  1. `found.kixie_link` → `respondDuplicate` (same as today, still runs first).
  2. `rowPhone10 = (phoneDigits(found.caller_phone) ?? '').slice(-10) || null`. If `rowPhone10 && phone10 && rowPhone10 !== phone10`, then:
     - leave `found` untouched (do not set `linkRow`),
     - insert a new row with `researchCallInsert({ dialer_agent_user, ...(leadId ? { dialer_lead_id } : {}) })` and no `dialer_call_id`. Set `researchCallId` from it; if the insert fails, log the error message only.
     - `notesSuffix = ' | id-mismatch'`, `idMismatch = true`, `linked` stays `null`.
  3. Otherwise `linkRow = found; linked = 'uid'` (same as today, including when either phone is missing).
- The normal new-booking path then runs as usual. The notes become `... API Submission | id-mismatch`.
- 201 response: add `idMismatch: true` only when the flag is set (spread conditionally). All other fields and responses are unchanged. The fallback `if (!linked) linked = 'uid'` near line ~421 is skipped when `idMismatch`, so the response reports `linked: null`.

### 2. `supabase/functions/submit-public-script/index.ts`
- New helper near `adoptable`: `phoneMismatch(d)` is true when `(phoneDigits(d.caller_phone) ?? '').slice(-10)` and `(dialerPhone ?? '').slice(-10)` are both non-empty and differ. `caller_phone` is already in `DIALER_SELECT`.
- `insertUnlinked(outcome, idMismatch = false)` adds `idMismatch: true` to `_dialer` only when the flag is set.
- At both adopt decision points (lines ~757 and ~762):
  `adoptable(d) ? (phoneMismatch(d) ? insertUnlinked(outcome, true) : adopt(d, outcome)) : insertUnlinked(outcome)`.
- Nothing else changes: adopt's internal retry to `insertUnlinked`, the BUG-005 save model, the merge rules and corrective #2 all stay as they are.

### 3. `src/pages/research/ScriptBuilder.tsx`
- `SCREEN_POP_QUERY` → `?uid=--A--recording_id--B--&lead=--A--lead_id--B--&phone=--A--phone_number--B--&agent=--A--user--B--&campaign=--A--campaign--B--`.
- Help line → "Send the same recording_id as `recordingId` in the recording POST so the form and the recording link to the same call."

### 4. `src/pages/ApiDocs.tsx` (submit-conversation-audio section)
- Param table: add `recordingId` (string, optional): "ViciDial recording_id (--A--recording_id--B--), max 64 chars. Link key that ties this recording to the screen-pop form for the same call." Change `uniqueid` to "Legacy alias of recordingId", and note that `recordingId` wins if both are sent.
- Duplicate response label: "same recordingId posted again".
- Linking text: says `recordingId`, and `"uid"` is described as matched by call key. Add a sentence: a call-key match whose phone number differs is not linked; a separate record is created and the response carries `linked: null` and `idMismatch: true`.
- Screen-pop URL example uses `--A--recording_id--B--`.

## Not changed
- `PublicScriptView.tsx` and its URL param names (`uid`, `lead`, `phone`, `agent`, `campaign`).
- The CR-006 guard, the ±30-min fallback and `| unlinked` note, the duplicate response, corrective #2, BUG-005..008, credential auth and rate limit, merge rules, existing rows, the database, types.ts, dependencies.

## Verification
- `tsgo --noEmit -p tsconfig.app.json`; `deno check` for both functions.
- Deploy both functions. Unsigned POST `{}` should give 401 for submit-conversation-audio and 400 "token is required" for submit-public-script, the same as before.
- No test surveys or recordings; QA proves it live. Nothing published.
