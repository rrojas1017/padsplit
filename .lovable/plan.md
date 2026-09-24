# Security Fix P8 — 6 public-facing edge functions

Shared modules: `_shared/auth.ts` (requireUser, canSeeBooking, adminClient, corsHeaders, timingSafeEqual, STAFF) and `_shared/url.ts` (isAllowedRecordingUrl, safeRecordingFetch). Response shapes unchanged except the new 400/401/403/404/429/503. No logging of tokens, secrets, client secrets or hashes. config.toml, src/**, SQL, RLS, migrations, other functions, prompts and cost logic are not touched.

Confirmed before writing: `api_rate_limit_hit(p_client_id text, p_limit integer)` exists and returns `TABLE(allowed, remaining, reset_at)`; `api_credentials.rate_limit` exists; `recordings.vixicom.com` is on the allowed list.

## 1. verify-email
- Lines 3–6: remove the local `corsHeaders`; add `import { corsHeaders, requireUser, canSeeBooking, STAFF } from "../_shared/auth.ts";`.
- After OPTIONS (line 36), before `try`: `const auth = await requireUser(req, STAFF); if (!auth.ok) return auth.response;`
- After the bookingId/email check (after line 48): `if (!(await canSeeBooking(auth.ctx, bookingId))) return 404 {error:'Booking not found'}`.
- Line 50: stop printing the email address in the log (keep the booking id only). Line 142 gets the same change. The service-role update (lines 145–156) stays as it is.

## 2. verify-email-realtime
- Lines 3–6: use the shared import `{ corsHeaders, requireUser, STAFF }`.
- After OPTIONS (line 22): `requireUser(req, STAFF)`, returning `auth.response` on failure.
- Line 52: stop printing the email address in the log.

## 3. proxy-recording-audio
- Lines 1–7: remove the `createClient` import and the local `corsHeaders`; import `{ corsHeaders, requireUser, STAFF }` from auth.ts and `{ isAllowedRecordingUrl, safeRecordingFetch }` from url.ts.
- Lines 15–36 (manual getUser): replace with `const auth = await requireUser(req, STAFF); if (!auth.ok) return auth.response;`
- Lines 48–65: read with `auth.ctx.userClient.from('bookings').select('kixie_link').eq('id', bookingId).maybeSingle()`, so the booking's access rules decide what each user can see. If there is no row, no link, or `!isAllowedRecordingUrl(link)`, return 404 `{error:'No recording found'}`.
- Line 68: `await safeRecordingFetch(booking.kixie_link)` instead of `fetch`. Keep the existing 502 path. If the helper throws on a blocked redirect, the existing catch returns 500. Streaming and headers (lines 77–94) are unchanged.

## 4. get-wallboard-data
- Lines 4–7: use the shared `corsHeaders` import. The token validation, expiry check and view logging (lines 53–124) are unchanged.
- Line 129: `select('id,name')`.
- Lines 137–139: `select('id,name,site_id,active,avatar_url')`, plus `.eq('site_id', tokenData.site_filter)` when `site_filter` is set.
- Lines 151–157: select `id,agent_id,booking_date,move_in_date,status,record_type,booking_type,market_city,market_state,communication_method,move_in_day_reach_out,created_at`, add `.neq('record_type','research')`, and when `site_filter` is set add `.in('agent_id', agentIds)` (if the list is empty, return an empty bookings list and skip the query). Keep the 30-day window, `neq status 'Non Booking'`, the ordering, `limit(500)` and the response structure.

## 5. submit-conversation-audio
- Lines 3–6: use the shared import `{ corsHeaders, adminClient as sharedAdmin }` (aliased so it does not clash with the local `adminClient` variable), plus `{ isAllowedRecordingUrl }` from url.ts. The credential checks (lines 32–68) are unchanged, except that line 46 also selects `rate_limit`.
- After line 68 (credential validated), add the rate limit:
  - `const { data: rlRows, error: rlErr } = await sharedAdmin().rpc('api_rate_limit_hit', { p_client_id: clientId, p_limit: credential.rate_limit ?? 60 });`
  - Use the first row (`rl = Array.isArray(rlRows) ? rlRows[0] : rlRows`).
  - If `rlErr`: log `rlErr.message` only and continue (fail open).
  - If `rl && !rl.allowed`: return 429 `{error:'Rate limit exceeded'}` with headers `Retry-After = max(1, ceil((reset_at - now)/1000))` and `X-RateLimit-Remaining: 0`.
  - Otherwise keep `remaining` for the success response.
- After the field validation (after line 89), before any lookup or insert:
  - `if (!isAllowedRecordingUrl(audioUrl))` → 400 `{error:'audioUrl host not allowed'}`.
  - `if (!isUuid && !/^[A-Za-z0-9 _.-]{1,100}$/.test(campaign))` → 400 `{error:'Invalid campaign'}`. The `isUuid` check (line 106) moves up so it runs before this.
- Line 261: the 201 response adds the `X-RateLimit-Remaining` header when a value is known. The body is unchanged.

## 6. receive-kixie-webhook
- Lines 4–7: use the shared `{ corsHeaders, timingSafeEqual }` import. The shared headers already allow any extra header; add `x-webhook-secret` if it is missing.
- Keep the disabled → 403 check (lines 54–60).
- Lines 62–72: if `!settings.webhook_secret`, return 503 `{error:'Webhook secret not configured'}`. Otherwise `const provided = req.headers.get('x-webhook-secret') ?? ''`, and if `!(await timingSafeEqual(provided, settings.webhook_secret))` return the existing 401 `{error:'Invalid webhook secret'}`.

## Verification
- Run `deno check` on all 6, then deploy all 6.
- Public-key POST `{}`: verify-email, verify-email-realtime and proxy-recording-audio should return 401.
- get-wallboard-data with `{"token":"fake"}` should return the existing 401 `{valid:false,error:'Invalid token'}`.
- submit-conversation-audio with no credentials should return the existing 401 "missing API credentials".
- receive-kixie-webhook POST `{}` should return 403 "Webhook is disabled".

## Notes and risks
- The wallboard page will get fewer fields per booking and agent. Any wallboard view that reads another field would show blank for it. The listed fields are the ones given in the request; the app code is not being changed.
- Recordings behind a redirect to a host outside the list will no longer play (404/500).
- The ViciDial integration keeps working unless its campaign names contain characters outside letters, numbers, space, `_ . -`. The 5 known campaign keys all fit, except `Move-in-out-Research:-Member-experience-&-Reason-code-Classification`, which contains `:` and `&` and would be rejected with 400. **Decision needed:** allow `:` and `&` too (they are safe once the value is quoted in the filter), or keep the pattern exactly as specified.
