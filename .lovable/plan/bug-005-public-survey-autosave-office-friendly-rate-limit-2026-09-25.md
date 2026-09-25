# BUG-005 — Public survey autosave + office-friendly rate limit

## Files touched (exactly four)
1. `supabase/functions/submit-public-script/index.ts`
2. `src/pages/PublicScriptView.tsx`
3. `src/components/research-insights/ScriptInsightsPanel.tsx` (Submissions tab only)
4. NEW `supabase/migrations/20260925140000_capture_bug005_research_calls_in_progress.sql` — written byte-for-byte from the ticket, not run or applied

Nothing else changes. No DB change, RLS, dependencies, `_shared/auth.ts`, `persist-research-raw-answers`, `validate-script-token`, Reports, or generate-research-insights. Leaderboard/SiteFilter/useAgentGoals are not touched. Deploy only submit-public-script.

## 1. submit-public-script handler flow

These steps are unchanged, in this order: size cap (100 KB), JSON parse, `submission_id` parse, token required, 200-response and 5,000-char guards, token lookup (403 if inactive or expired), script lookup (404), inactive script (409), language question selection, response normalization, `buildRawScriptAnswers`, campaign resolution (400), client hash.

New fields: `final` = `body.final === false ? false : true` (so old clients count as final). `saveSeq` is an integer ≥ 0 or null.

Terminal outcome (when final is true) is worked out exactly as today: declined → refused, endedEarly → ended_early, 0 answers → refused, else completed. When final is false the outcome is `in_progress`, and endedEarly/declined are ignored.

Shared helpers inside the file:
- `buildEnriched(existing?)`: today's `enrichedResponses` plus `_save_seq: saveSeq`. `_early_disposition` is set only on a terminal ended_early.
- `ok(row, bookingId)`: returns `{ ok:true, research_call_id, booking_id, status: call_outcome, raw_answers_count, saved_at: new Date().toISOString() }`.
- `finalizeSideEffects(callId, outcome, { repair })`: today's booking, booking_transcriptions and script_responses block moved in unchanged (booking rule, has_valid_conversation=true, survey_progress, routing type, partial metadata). The `total_responses` +1 runs only when `outcome==='completed' && !repair`. In repair mode it first checks `bookings.research_call_id = callId` and `script_responses.session_id = callId` and skips any part that already exists.

### A. No submission_id (legacy client)
Today's path unchanged: rate limit (new limits, see R7), insert the terminal row, run side effects, return `ok`.

### B. With submission_id — look up the existing row
`select id, call_outcome, created_at, responses where responses->>_submission_id = :sid` (unique index, so the campaign filter is dropped).

**B1. No row → insert path**
1. Rate limit (R7). Per client hash: count rows with `_client_hash` and `created_at ≥ now−10m`. If ≥120 → 429. Per token: count `_token_id` rows in the last 1h. If ≥600 → 429. `retry_after` = seconds until the oldest row in the breached window leaves it (fetch the oldest `created_at` in the window via order asc limit 1), minimum 1. The 429 body is `{ error:'Too many submissions from this office right now', retry_after }` with a `Retry-After` header.
2. Insert the row with `call_outcome` = in_progress or the terminal outcome, `responses = buildEnriched()`.
3. On error code `23505` (the submission_id key) → re-read the row and continue at B2 (race, R6).
4. If the row was inserted terminal → run `finalizeSideEffects(id, outcome)`. Return `ok`.

**B2. Row exists**
- Token check: if `responses._token_id !== tokenRow.id` → 403 "Submission belongs to another link".
- **Row is terminal (R3 + repair R4):** if it qualifies for a booking (completed, or ended_early with ≥1 answer in its stored responses) and no booking is linked → `finalizeSideEffects(id, outcome, { repair:true })`, rebuilding raw answers from the stored row responses. Then return `ok` with the linked booking. The row itself is never written.
- **Row is in_progress:**
  - If `created_at` is older than 6h → 409 "Submission expired".
  - **final=false:** if `saveSeq != null` and the stored `_save_seq != null` and `saveSeq ≤ stored` → return `ok`, no write. Otherwise `UPDATE … SET responses, call_duration_seconds, caller_name, language WHERE id AND call_outcome='in_progress'`. If 0 rows come back (it went terminal meanwhile), re-read and return the terminal `ok`.
  - **final=true:** atomic flip `UPDATE … SET call_outcome=:terminal, responses, duration … WHERE id=:id AND call_outcome='in_progress' RETURNING id`. If a row comes back → this request owns the side effects → `finalizeSideEffects`. If no row comes back → another request already flipped it → re-read and go to the terminal branch (repair check only, no increment).
- The `last_accessed_at` touch stays as today, fire and forget, on every success.

Updates never touch the rate limit.

## 2. PublicScriptView.tsx — client save queue

- `submissionIdRef` (existing), `saveSeqRef = 0`, `inFlightRef`, `pendingRef: {final, opts} | null`, `lastAttemptRef`.
- `requestSave(final, opts)`: if a request is in flight, store it in `pendingRef` (latest wins, and a pending final always stays final). Otherwise call `send()`.
- `send()`: `saveSeqRef += 1`, then build the payload from current refs (answers, notes, duration, callerName, language, endedEarly/declined, `final`, `save_seq`, `submission_id`) and call `supabase.functions.invoke('submit-public-script')`.
  - On success: set `saveState='saved'`, `lastSavedAt`, `lastSavedAnswers=raw_answers_count`, `dirty=false`, and `terminalSaved=true` when final.
  - On error: read `FunctionsHttpError.context` (status + json). The message is 429 → "Too many submissions from this office right now, retry in {retry_after}s"; 403/409 → the server error text; 5xx or network → "Server error". Set state to failed.
  - In `finally`, if there is a pending request → send it.
- Answer state is mirrored into refs so a queued send uses the latest state.
- Triggers:
  - Autosave (final=false) after each Next/Finish in the question phase, and when consent = Yes.
  - Terminal save (final=true): the done-phase effect (as today), `handleEndCall` (as today), and consent = No reaching done (sets declined, then goes through the same done effect).
- Banner (existing components and tokens only), shown for every phase except `start`, below the progress bar and on the done screen: "Saving…" / "Saved HH:MM:SS · N answers" (local time) / "Not saved — reason" with a Retry button. Retry re-sends `lastAttemptRef.final` with the current state.
- `beforeunload` is registered while `phase !== 'start'` and (`dirty` or `!terminalSaved`).
- Restart: works directly once `terminalSaved` is true. Otherwise it opens an AlertDialog: "This survey is not saved and will be lost. Restart anyway?" Confirming resets everything, including a new submission_id and seq.
- `submitState` is replaced by the new save state. The duration capture stays as today.

## 3. Everything that reads research_calls — what in_progress does today, and the change

| Reader | What it does | Effect of an in_progress row | Change |
|---|---|---|---|
| ScriptInsightsPanel Submissions tab | Lists rows, KPIs total/completed/endedEarly/refused | Counted in total; badge shows raw "in_progress" | Label "In progress"; add an "In progress" KPI; exclude it from total-derived completed/ended/refused (already separate filters) |
| useResearchCampaigns (CampaignManager progress) | `eq('call_outcome','completed')` | None | None |
| useResearchCampaigns.deleteCampaign | Counts all linked calls | Stops a campaign with a draft from being deleted (same as any other linked row) | None (safe) |
| useResearchCalls (MyCampaigns progress) | `eq completed` | None | None |
| useResearchCalls.fetchMyCalls / MyCallHistory | `researcher_id = me` | Public rows have researcher_id null, so they never appear | None |
| persist-research-raw-answers | Takes an explicit research_call_id from the researcher runtime | Never gets public rows | None (forbidden) |
| generate-research-insights (line ~1301) | Campaign → call ids, then reads **bookings** | No booking, so nothing happens | None |
| process-research-record | Booking → call → campaign | Only runs for existing bookings | None |
| transcribe-call (survey progress, name enrichment) | Starts from a booking | Only runs for existing bookings; phone lookup finds nothing (public caller_phone is null) | None |
| submit-conversation-audio | Insert only | — | None |

No completion-rate calculation reads research_calls outside the rows above.

## 4. Reports
No change. useReportsData and Reports read `bookings`, and in_progress rows create no booking (R2).

## 5. AI summaries and crons
generate-research-insights script mode and move-out/audience mode read `bookings`/`booking_transcriptions`, and cron calls go through the same function. No change.

## 6. Capture file
Written as a plain file with the exact ticket content and a trailing newline, then `wc -l` and `md5sum` are reported. Not executed.

## Verification
- tsgo `--noEmit -p tsconfig.app.json`; deno check on submit-public-script; deploy it; fake-token POST → 403.
- The acceptance cases that need a real link and real rows (autosave row, ended_early side effects, Retry idempotency, the 121st insert → 429) are run only with your go-ahead, because they write real research rows.
