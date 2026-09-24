# Security Fix P1 — Edge Function Authorization + Disable Public Sign-ups

Scope: edge functions, `supabase/config.toml`, and the auth sign-up setting only. No `src/**`, SQL, RLS, or migration changes.

## Pre-checks done
- `supabase/functions/_shared/` does not exist yet (will be created).
- `public.get_internal_function_secret()` exists (present in generated types).
- `profiles.can_send_email` / `can_send_sms` and `bookings.contact_email` / `contact_phone` exist.
- `batch-retry-transcriptions` is only invoked from `src/pages/Settings.tsx` (user JWT) — no cron/internal caller found, so `requireUser(ADMINS)` will not break a scheduler.

## Files

Create
- `supabase/functions/_shared/auth.ts` — exact content provided (Task 1).
- `supabase/functions/_shared/url.ts` — exact content provided (Task 2), not imported yet.

Modify
- `supabase/functions/manage-api-credentials/index.ts`
- `supabase/functions/send-follow-up-email/index.ts`
- `supabase/functions/send-follow-up-sms/index.ts`
- `supabase/functions/validate-login-ip/index.ts`
- `supabase/functions/batch-retry-transcriptions/index.ts`
- `supabase/config.toml`

## Per-function changes

**manage-api-credentials**
- Delete local `corsHeaders`, the `Bearer` check, atob decode, and `user_roles` `.single()` lookup.
- Import `requireUser, ADMINS, adminClient, corsHeaders` from `../_shared/auth.ts`.
- After OPTIONS: `const auth = await requireUser(req, ADMINS); if (!auth.ok) return auth.response; const userId = auth.ctx.userId;` DB via `adminClient()`.
- `regenerate`: `.update(...).eq('id', id).eq('status','active').is('deleted_at', null).select()`; 0 rows → 404 `{error:'Credential not found or not active'}`. The status stays `active` (no longer used to re-activate revoked keys).
- `revoke` / `delete`: add `.select('id')`; 0 rows → 404 `{error:'Credential not found'}`. Also guard `.is('deleted_at', null)` so deleted rows aren't touched.
- Hashing (`sha256Hex`, `sk_`/`app_` prefixes) and success response shapes are unchanged.

**send-follow-up-email / send-follow-up-sms**
- Remove local `corsHeaders`, atob decode, and the profile permission query.
- `const auth = await requireUser(req, STAFF)`; `profile = auth.ctx.profile`.
- Email: `can_send_communications === true && can_send_email === true`; SMS: `can_send_communications === true && can_send_sms === true`; otherwise 403 with the existing message.
- After required-field validation: `canSeeBooking(auth.ctx, bookingId)` (RLS as caller) → else 404 `{error:'Booking not found'}`.
- Load `contact_email, contact_phone` with `adminClient()`. Email compares trimmed lowercased values; SMS compares last 10 digits (a null/short contact value means no match). Mismatch → 400 `{error:'Recipient does not match the booking contact'}`.
- `user_name` for the log comes from a small `profiles.name` lookup (the shared profile type has no `name`); `user_id: auth.ctx.userId`. SendGrid/ClickSend calls and responses are unchanged.

**validate-login-ip**
- Replace atob with `requireUser(req, ANY_ROLE, { allowNoRole: true, allowInactive: true })`.
- `!auth.ok` → 200 `{blocked:false, message:'Unauthenticated, skipping IP check'}` with no `access_logs` insert.
- `userId = auth.ctx.userId`; `role = auth.ctx.role ?? 'agent'`. The existing role lookup is replaced by this; the rest of the logic is unchanged. Local `corsHeaders` is swapped for the shared one.

**batch-retry-transcriptions**
- After OPTIONS: `const auth = await requireUser(req, ADMINS); if (!auth.ok) return auth.response;`. Everything else stays the same. Internal calls to `transcribe-call` keep the service-role bearer. The local `corsHeaders` stays (the shared one is a superset; kept to limit changes).

## config.toml
Set `verify_jwt = true` on these 5 entries only: `manage-api-credentials`, `send-follow-up-email`, `send-follow-up-sms`, `validate-login-ip`, `batch-retry-transcriptions`. No other lines change.

## Disabling public sign-ups
Call the auth configuration tool with `disable_signup: true`. Other settings stay as they are: `auto_confirm_email: false`, `external_anonymous_users_enabled: false`, and the current password-leak (HIBP) setting (read first and passed through unchanged). Email+password login keeps working. `create-user` (`auth.admin.createUser`, service role) is unaffected.

## Deploy
Deploy the 5 functions. If the bundler rejects `../_shared/auth.ts`, stop and report without inlining. Then run smoke tests with the anon key: each function should return 401 (validate-login-ip should return 200 `blocked:false`), and nothing should log a token.

## Concerns and limits
1. **validate-login-ip + verify_jwt=true:** it runs right after sign-in with the user JWT, so this is fine. A call with no token is now rejected by the gateway (401) before the function's 200 fallback runs. Your 200 fallback therefore only applies to invalid/expired JWTs that are properly signed. If the login page ever calls it without a session, that call will now fail. I'm flagging this rather than changing the frontend.
2. **Preview auth is signed out:** I can only verify the 401/403 paths with the anon key. I can't run an authenticated end-to-end test (such as sending a real email or SMS) unless I mint a session. If you want that, I'll mint one with the approval step.
3. **Legacy-JWT gateway:** earlier in this project, deploys hit "Invalid JWT" 401s from the gateway on `verify_jwt=true`. If signing keys cause gateway-level 401s for real users after deploy, the safe fallback is `verify_jwt=false`, since in-code `getUser` does the real check. I'll report it rather than change it on my own.
4. **Response shapes:** the new 404 on revoke/delete/regenerate and the recipient-mismatch 400 are new non-2xx paths, as you requested. The frontend already surfaces `error` strings.
5. `access_logs` inserts and the other helper behavior are otherwise unchanged. No secrets are added, and the internal secret is only read via the RPC.
