# Security Fix P4 — Authorize 6 AI-pipeline functions

Scope: only the 6 functions below. No changes to src/**, SQL, RLS, migrations, config.toml, other functions, prompts, models, provider weights or cost logic. All 6 stay `verify_jwt = true`.

Each function's local `const corsHeaders = {...}` is replaced by the shared `corsHeaders` import from `../_shared/auth.ts` (superset, also allows `x-internal-secret`). Guards go right after the OPTIONS branch.

## 1. transcribe-call (2565 lines)
- Imports: `requireUserOrInternal, canSeeBooking, jsonResponse, corsHeaders, STAFF` from `../_shared/auth.ts`; `isAllowedRecordingUrl` from `../_shared/url.ts`. Remove local corsHeaders (line 10).
- Entry, lines 2468-2471 replaced:
  - `const auth = await requireUserOrInternal(req, STAFF); if (!auth.ok) return auth.response;`
  - `const { bookingId, skipTts = false } = await req.json();` (a `kixieUrl` field in the body is accepted and ignored)
  - `if (!bookingId) return jsonResponse(400, { error: 'Missing bookingId' })`
  - `if (!(await canSeeBooking(auth.ctx, bookingId))) return jsonResponse(404, { error: 'Booking not found' })`
  - Load `kixie_link` from `bookings` with the service-role client; if missing or `!isAllowedRecordingUrl(url)` → `jsonResponse(400, { error: 'Recording URL missing or not allowed' })`.
- Line 2540: `processTranscription(bookingId, recordingUrl, skipTts)` uses the DB URL.
- Background download (line 1557): `redirect: 'manual'`; on 3xx read `Location`, resolve against the current URL, follow at most 3 hops only if each passes `isAllowedRecordingUrl`, otherwise throw `Audio download redirect not allowed`.
- Downstream calls to generate-qa-scores / process-research-record (line 2233-2237) already send the service-role bearer, so no change is needed.

## 2. process-research-record (1368 lines)
- Replace local corsHeaders (line 3). After OPTIONS (line 1027): `const auth = await requireInternal(req); if (!auth.ok) return auth.response;`. Nothing else changes.

## 3. generate-qa-scores (284 lines)
- Replace local corsHeaders (line 4). After OPTIONS: `requireInternal(req)`.
- Lines 76-90 (manual getUser attribution) replaced with `const triggeredByUserId: string | null = null; const isInternal = false;`. That matches what happens today for its only caller (transcribe-call, which uses the service-role bearer, so it never resolves to a user). The cost logging at lines 217-218 is unchanged.

## 4. generate-coaching-audio (496 lines)
- Replace local corsHeaders (line 4). After OPTIONS: `requireUserOrInternal(req, STAFF)`.
- After `bookingId` is read (line 95) and its existing missing check: `canSeeBooking` → 404 `{error:'Booking not found'}`.
- Lines 107-120 replaced: `triggeredByUserId = auth.ctx.kind === 'user' ? auth.ctx.userId : null`; `isInternal = auth.ctx.kind === 'user' && auth.ctx.role === 'super_admin'`. Cost logging at 319-320 and 427-428 is unchanged.

## 5. generate-qa-coaching-audio (565 lines)
- Same as 4 (corsHeaders line 5, guard after OPTIONS, canSeeBooking after line 97).
- Lines 111-140 replaced with the same auth.ctx attribution. The atob "JWT decode fallback" (lines 127-139) is removed entirely.

## 6. reanalyze-call (889 lines)
- Replace local corsHeaders (line 5). After OPTIONS: `requireUserOrInternal(req, MANAGERS)`; after `bookingId` (line 757): `canSeeBooking` → 404.
- Lines 768-782 replaced with the auth.ctx attribution. The values passed at lines 841-842 are unchanged.

## Deploy and test
Deploy the 6 functions. Then send an anon-key POST to each. Expected result: 401 for all 6.

## Findings and flags
- Current recording hosts in `bookings.kixie_link`: recordings.vixicom.com (49,200), calls.kixie.com (6,584), *.hubspotusercontent-na1.net (171), five9, app.kixie.com and app.hubspot.com (a few). All of these pass the allowlist. There are 121 non-URL values and 1 `sf2.vixicom.local`. Those rows will now get 400 instead of a failed transcription.
- `CallDetailsModal.tsx` also calls transcribe-call with the user JWT. It keeps working for STAFF roles.
- I disagree with leaving one path open. `validateAudioUrl` (line 808) sends a HEAD request that follows redirects by default, so it could still be steered to an internal host through a redirect. I recommend applying the same `redirect: 'manual'` plus 3-hop allowlist check there (a small shared helper inside transcribe-call). I'll include this unless you say no.
- Deepgram URL mode (line 1553) has Deepgram's servers fetch the URL, not ours. The initial allowlist check covers it.
- Agents: STAFF must include `agent` for agents to keep generating coaching audio, as your spec intends. `canSeeBooking` limits agents to their own bookings.
- The anon-key test is the only test I can run. Preview auth is signed out, so the signed-in flow and the internal chain need a real run to confirm.
