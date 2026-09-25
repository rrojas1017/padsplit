# CR-005 Phase 1 — Link the ViciDial web form and the API recording into one call record

## What changes for the business
When the screen-pop form and the dialer recording belong to the same ViciDial call, they end up as one research call and one booking. Typed answers win over AI answers. The transcript, summary and AI extraction are always kept. Recordings and forms without the new fields work exactly as they do today.

## Files
- `supabase/functions/submit-public-script/index.ts`
- `supabase/functions/submit-conversation-audio/index.ts`
- `supabase/functions/transcribe-call/index.ts`
- `src/integrations/supabase/types.ts`: this file already has `dialer_call_id` (3 matches). Regenerating it should change nothing. If it does change, only the generated file is written.

There is no migration, SQL, RLS or frontend change, and no other file changes. After deploying, I run `deno check` on the three functions and `tsgo`, then send an unsigned POST to each. Nothing is published.

---

## A. Input hygiene (a local copy in each function; `_shared` is not in the allowed files)

```ts
// deno-lint-ignore no-control-regex
const cleanDialer = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return s && s.length <= 64 ? s : null;
};
const phoneDigits = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const d = v.replace(/\D/g, '').slice(0, 15);
  return d || null;
};
const last10 = (d: string | null) => (d ? d.slice(-10) : null);
const isDialerKeyConflict = (e: any) =>
  e?.code === '23505' &&
  /research_calls_campaign_dialer_call_key/.test(`${e?.message ?? ''} ${e?.details ?? ''}`);
```
- Bad values are treated as absent. They never cause a 400 and are never logged. Log lines say only whether a value was present, for example `uid=yes`.
- **How 23505 is identified:** by the code `23505` plus the constraint name `research_calls_campaign_dialer_call_key` in the error message or details. The existing BUG-005 check for `research_calls_submission_id_key` stays separate. A 23505 on the submission-id key keeps today's handling (re-read by `_submission_id`).

---

## B. submit-public-script

**New body fields:** `dialer_uid`, `dialer_lead`, `dialer_phone`, `dialer_agent`, `dialer_campaign`. They are cleaned right after the existing destructure. `dialerPhone` is `phoneDigits(dialer_phone)`.

**B1. Campaign (replaces lines 264–281 only when `dialer_campaign` is set).** If `dialerCampaign` is set, run:
`research_campaigns.select('id, script_id').eq('campaign_key', dialerCampaign).maybeSingle()`
- A match with `script_id === script.id` is used.
- Anything else falls through to the existing "latest active, then latest" queries, unchanged.

**B2. Agent for a booking the form creates** (inside `finalizeSideEffects`, replacing the `anyAgent` query):
- If `dialerAgent` is set: `agents.select('id').eq('dialer_agent_user', dialerAgent).limit(1).maybeSingle()`.
- If there is no match, or no `dialerAgent`: the existing `agents.eq('active', true).limit(1)` fallback, byte-identical.

**B3. Row insert helper.** `insertRow(outcome, withDialerId: boolean)` adds these fields:
- `caller_phone: dialerPhone` (today this is always null, and it stays null when absent)
- `dialer_agent_user: dialerAgent`
- `dialer_lead_id: dialerLead`
- `dialer_call_id: withDialerId ? dialerUid : null`

With no dialer fields, every added value is null. That gives the same row as today.

**B4. Lookup order** (the existing flow with one new step; `rateLimit()` stays where it is for new submissions):

```text
row = readRow()  (by _submission_id)                 -- today, unchanged
if row           -> existing-row path (token 403, terminal/handleTerminal, 6h 409, seq, flip)  -- unchanged
else:
  rateLimit()                                         -- unchanged placement
  if dialerUid:
     d = research_calls.select(id, call_outcome, created_at, responses, kixie_link, call_duration_seconds, caller_phone, dialer_lead_id, dialer_agent_user)
           .eq('campaign_id', campaign.id).eq('dialer_call_id', dialerUid).maybeSingle()
     if d and d.responses?._submission_id == null and age(d) <= 12h -> ADOPT(d)
     else if d                                        -> insert UNLINKED (see below)
     else -> insertRow(outcome, true);  on isDialerKeyConflict -> re-read d -> ADOPT(d)
                                          (if the re-read row is not adoptable -> insert UNLINKED)
  else -> insertRow(outcome, false)                   -- today's insert (+ B3 null-safe fields)
```
- **Legacy path (no `submission_id`):** it takes the same `dialerUid` step with `outcome = terminalOutcome`. Without `dialer_uid` it stays the single terminal insert of today. *Assumption: old clients may send `dialer_uid` without a `submission_id`. Say so if you'd rather keep the legacy path fully unlinked.*
- **UNLINKED:** `insertRow(outcome, false)` with `responses._dialer = { uid, lead, agent, campaign }` added to the enriched responses. `caller_phone` is `dialerPhone`. The response is a normal 200 with `linked: false`.
- **ADOPT(d):** one conditional update:
  ```ts
  admin.from('research_calls').update({
    responses: { ...(d.responses ?? {}), ...buildEnriched(outcome) },
    call_outcome: outcome,
    language: language || 'en',
    caller_name: callerName || 'Public Submission',
    ...(d.caller_phone == null && dialerPhone ? { caller_phone: dialerPhone } : {}),
    ...(d.dialer_lead_id == null && dialerLead ? { dialer_lead_id: dialerLead } : {}),
    ...(d.dialer_agent_user == null && dialerAgent ? { dialer_agent_user: dialerAgent } : {}),
    ...(d.call_duration_seconds == null && typeof durationSeconds === 'number' ? { call_duration_seconds: durationSeconds } : {}),
  })
  .eq('id', d.id)
  .is('responses->>_submission_id', null)
  .select('id');
  ```
  - `kixie_link` is never in the payload, so it is kept.
  - **0 rows** means another submission won. Re-read by `_submission_id`: if found, take the existing-row path; if not, insert UNLINKED.
  - **1 row with `outcome === 'in_progress'`** returns `ok(..., null)` with `linked: true`.
  - **1 row with a terminal outcome** runs `finalizeSideEffects` (B5), then `ok` with `linked: true`.
  - `buildEnriched` stamps `_token_id`, `_submission_id`, `_save_seq` and `_finalized_at` (terminal). After that, all BUG-005 rules apply unchanged: token ownership, seq, 6 h expiry measured from the row's `created_at`, immutability, and the repair guard.
- **B4b.** Rows created without `dialer_uid` still store `dialer_agent_user` and `caller_phone` through B3. The recording fallback match needs them.

**B5. `finalizeSideEffects`** (this runs for every terminal save, including legacy, flip, adopt and repair):
1. Look up `existing = findLinkedBooking(callId)` every time. Today it only runs in repair.
2. **If `existing` is set (the recording arrived first):**
   - No booking insert.
   - If `count > 0`: `bookings.update({ has_valid_conversation: true }).eq('id', existing)`.
   - Read `booking_transcriptions.select('research_extraction, research_campaign_type').eq('booking_id', existing).maybeSingle()`.
   - Upsert `{ booking_id, research_extraction: { ...ex, raw_script_answers: { ...(ex.raw_script_answers ?? {}), ...answers } }, survey_progress: <the form object>, ...(research_campaign_type == null && routedType ? { research_campaign_type, retag_source: 'script_id_route' } : {}) }` with `onConflict: 'booking_id'`.
   - The upsert payload never includes `call_transcription`, `call_summary` or `call_key_points`.
   - This step runs only when `count > 0`.
3. **If there is no booking:** today's insert, with the B2 agent and `contact_phone: dialerPhone` (null when absent, same as today). The transcription insert is unchanged.
4. **script_responses:** the existence check (`session_id = callId`) now always runs, not only in repair. For a fresh row it finds nothing, so behaviour matches today. The completed counter still requires `!repair` and a successful insert.
5. It returns `existing ?? newBookingId`. When the outcome doesn't qualify for a booking, it still returns `existing`, and writes nothing.

**B6. Response.** Every `ok()` adds `linked: boolean`. It is true when the row has a `dialer_call_id`, either adopted or inserted with one. The existing-row path reads `dialer_call_id` in `readRow` to set it.

---

## C. submit-conversation-audio

**New fields:** `uniqueid` and `leadId`, both cleaned with `cleanDialer`. The `phoneNumber` digits give `phone10`.

All new steps sit after `callStart` (line 189) and before today's `research_calls` insert (line 198). They run only when `matchedCampaignId` is set. Auth, the rate limit, validation, the host allow-list, campaign resolution and script type resolution all come before this and are unchanged.

**C1. `uniqueid` present:**
```ts
research_calls.select('id, kixie_link, caller_phone, dialer_lead_id, dialer_agent_user')
  .eq('campaign_id', matchedCampaignId).eq('dialer_call_id', uniqueid).maybeSingle()
```
- **Found and `kixie_link` is not null (a repeat post):** look up `bookings.select('id').eq('research_call_id', id)`. Return 200 `{ success: true, duplicate: true, bookingId, researchCallId }`. No `conversation_submissions`, booking or `access_logs` row is written.
- **Found and `kixie_link` is null (the form arrived first):** runs **LINK(row, 'uid')** below.
- **Not found:** today's `research_calls` insert plus `dialer_call_id: uniqueid`, `dialer_lead_id: leadId`, `dialer_agent_user: dialerAgentUser`. On `isDialerKeyConflict`, re-read and take the found branch. Any other insert error stays non-fatal, as today.

**C2. `uniqueid` absent (fallback):**
```ts
research_calls.select('id, kixie_link, caller_phone, dialer_lead_id, dialer_agent_user')
  .eq('campaign_id', matchedCampaignId).eq('caller_type', 'public')
  .eq('dialer_agent_user', dialerAgentUser)
  .gte('created_at', start - 30min).lte('created_at', start + 30min)
  .limit(50)
```
- `windowHasPublic` is true when this returns any rows.
- `candidates` are the rows with `kixie_link == null` and `last10(phoneDigits(caller_phone)) === phone10`.
- **Exactly one candidate:** LINK(candidate, 'fallback').
- **Otherwise:** today's inserts. The booking notes get `' | unlinked'` appended only when `windowHasPublic` is true.

**LINK(row, mode):**
1. Guarded update of the research call:
   `research_calls.update({ kixie_link: audioUrl, caller_phone?, dialer_lead_id?, dialer_agent_user? (each only if null) }).eq('id', row.id).is('kixie_link', null).select('id')`.
   If 0 rows, another recording won. Return the duplicate response above.
2. Look up `bookings.select('id, notes').eq('research_call_id', row.id).maybeSingle()`.
   - **Booking exists:** `bookings.update({ agent_id, kixie_link: audioUrl, contact_phone (only if null, read first), booking_date, move_in_date, call_started_at from callStart, notes: existing + ' | API Submission (linked)' }).eq('id', b.id).is('kixie_link', null).select('id')`. The existing AFTER UPDATE trigger queues transcription; no direct call is made.
   - **No booking:** today's booking insert, byte-identical, with `research_call_id = row.id`.
3. `conversation_submissions` insert, the routing-stamp upsert and `access_logs`, all as today.
4. Return 201 with the existing body plus `linked: mode`.

**C3.** Every non-duplicate response adds `linked: 'uid' | 'fallback' | null`. The duplicate response adds `duplicate: true`.

---

## D. transcribe-call (two guards, research bookings only)

The guard goes in the script-resolution block at lines 1940–1991, where `researchCallId` is already known. If `researchCallId` is set:
```ts
const { data: btRow } = await supabase.from('booking_transcriptions')
  .select('survey_progress').eq('booking_id', bookingId).maybeSingle();
const sp = btRow?.survey_progress as any;
formProgress = sp?.source === 'public_script' ? sp : null;
```
- **D2 (validity):** right after the validator block (after line 2019):
  `if (formProgress && (formProgress.answered ?? 0) > 0) hasValidConversation = true;`
  In other words, the validator result OR the form answers. The validator itself is unchanged. This value feeds the existing booking update (line 2122) and the research AI trigger that follows. That is intended: a form-backed call counts as valid.
- **D1 (survey progress):** the survey-progress gate at line 2028 becomes `if (isResearch && hasValidConversation && transcription && !formProgress)`. The AI call is skipped and `surveyProgress` stays null. The existing `...(surveyProgress ? {survey_progress} : {})` in the upsert then leaves the form's `survey_progress` untouched.

STT, the summary, key points, cost logging, the upsert fields and the validators are unchanged. For bookings with no form progress, the path is identical to today.

---

## Requests without the new fields take today's code path
- **submit-public-script:** with no `dialer_*` fields, it uses the same campaign queries and the same agent fallback. The insert sends extra columns, all null, so the row is identical. `finalizeSideEffects` adds one read, the linked-booking lookup, which finds nothing for a fresh row. The script_responses existence check runs once and finds nothing. The only other change is `linked: false` in the response. Written data is identical.
- **submit-conversation-audio without `uniqueid`:** the fallback read runs. Today no public rows carry `dialer_agent_user`, so it returns 0 rows: no link, no `' | unlinked'`, and identical inserts and notes. The response adds `linked: null`. Without a matched campaign, nothing new runs at all.
- **transcribe-call:** for rows without a `public_script` survey_progress, there is one extra read and nothing else.

## Known residual risk (no schema change allowed in this phase)
`bookings.research_call_id` has no unique constraint. If a form's terminal save and a first recording for the same call land within the same few milliseconds, both can see "no booking" and each insert one. The uid guard on `research_calls` makes this narrow but not impossible. Rows are never deleted. If you want it closed, a later phase can add a partial unique index on `bookings(research_call_id)`.
