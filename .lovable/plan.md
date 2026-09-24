# Security Fix P2: Remove 24 Unused, Unauthenticated Edge Functions

## Reference re-check (done before planning)
I searched `src/**`, `supabase/functions/**` (excluding each function's own folder) and `supabase/migrations/**` for each of the 24 names. No real caller was found. The only matches are harmless:
- `backfill-payment-experience` and `-eligible-only`: these hits are word-prefix matches inside the sibling `backfill-payment-experience-*` folders, which are all being deleted too. They are self-invocation URLs and comments like "superseded by ...-eligible-only". None of them is outside the deletion set.
- `fix-incomplete-bookings`: `batch-retry-transcriptions/index.ts:449` only mentions the name inside a user-facing text string ("Use fix-incomplete-bookings for those."). It never calls the function. I am leaving that string alone because the rules say no other function may change. It will just be stale wording.

Result: nothing is excluded, and all 24 are deleted. `cleanup-coaching-audio` and every other function are untouched.

## What gets deleted

| # | Function | Folder | config.toml block |
|---|---|---|---|
| 1 | backfill-conversation-validation | yes | yes |
| 2 | backfill-detected-issues | yes | yes |
| 3 | backfill-deterministic-linkage | yes | none |
| 4 | backfill-historical-costs | yes | yes |
| 5 | backfill-member-details | yes | yes |
| 6 | backfill-payment-experience | yes | none |
| 7 | backfill-payment-experience-dues-day | yes | none |
| 8 | backfill-payment-experience-eligible-only | yes | none |
| 9 | backfill-payment-experience-names | yes | none |
| 10 | backfill-payment-experience-progress | yes | none |
| 11 | backfill-payment-experience-raw-script-answers | yes | none |
| 12 | backfill-payment-experience-stated-answers | yes | none |
| 13 | backfill-survey-progress | yes | yes |
| 14 | batch-enrich-contacts | yes | yes |
| 15 | batch-generate-coaching-audio | yes | yes |
| 16 | batch-reanalyze-coaching | yes | yes |
| 17 | batch-reanalyze-member-details | yes | yes |
| 18 | check-deepgram-plan | yes | yes |
| 19 | check-elevenlabs-plan | yes | yes |
| 20 | fix-incomplete-bookings | yes | yes |
| 21 | phase4-repair-pe-artifacts | yes | none |
| 22 | recalculate-pro-pricing | yes | yes |
| 23 | reclassify-other-records | yes | none |
| 24 | validate-payment-keyword-backfill | yes | none |

## Steps
1. Delete the 24 deployed functions with the delete-edge-function tool, all in one call.
2. Remove the 24 `supabase/functions/<name>/` folders.
3. Remove the 13 matching `[functions.<name>]` blocks (header plus `verify_jwt` line) from `supabase/config.toml`. No other entry changes.
4. Verify: call each function with a POST using the anon key and expect 404. Re-run the grep so that only the known string in `batch-retry-transcriptions` remains.
5. Report per function: folder removed, config entry removed or not applicable, deployed function deleted, and the anon call status code.

## Out of scope
No changes to `src/**`, SQL, RLS, migrations, or any other function or config entry.

## Caveat
The per-function "ran recently" check is based on your audit, which covered pg_cron and triggers. I did not re-query pg_cron or triggers myself. I can add that read-only check as step 0 if you want it.

---

# Security Fix P3: Authorize 6 Functions Called by Both the Database and the App

This uses the existing `supabase/functions/_shared/auth.ts` as is. Each function's local `corsHeaders` is replaced by the shared import. The shared version is a superset that also allows `x-internal-secret`, so browser preflights keep working.

## Per function

**1. cleanup-coaching-audio** (guard: `requireInternal`)
- Delete the local `corsHeaders` (lines 3-6) and import from `../_shared/auth.ts`.
- After OPTIONS (line 89-91) insert `const auth = await requireInternal(req); if (!auth.ok) return auth.response;`
- Attribution: not applicable. Only cron job 1 calls it.

**2. analyze-member-insights** (guard: `requireUserOrInternal(req, ADMINS)`)
- Replace the local `corsHeaders` (lines 3-6) with the shared import.
- Insert the guard right after OPTIONS (line 966).
- Line 976: stop destructuring `created_by` from the body.
- Replace lines 978-993 (the manual `getUser` + `user_roles` block) with:
  - `triggeredByUserId = auth.ctx.kind === 'user' ? auth.ctx.userId : null`
  - `isInternal = auth.ctx.kind === 'user' && auth.ctx.role === 'super_admin'`. This keeps today's rule of marking super_admin-triggered costs as internal.
- Line 1007: `created_by: triggeredByUserId` (null for cron).

**3. analyze-non-booking-insights** (guard: `requireUserOrInternal(req, ADMINS)`)
- Replace the local `corsHeaders` (lines 5-8) with the shared import. Insert the guard after line 460.
- Attribution is computed the same way (`triggeredByUserId`, plus `isInternal` for super_admin). At line 508 it is passed into the existing `processAnalysis(..., triggeredByUserId, isInternal)` parameters, which today always default to null/false. The request body is not read for identity.

**4. generate-research-insights** (guard: `requireUserOrInternal(req, MANAGERS)`)
- Replace the local `corsHeaders` (lines 7-10) with the shared import.
- The guard runs right after OPTIONS (line 1007), before both the resume path and the initial path.
- Replace lines 1040-1048 (the atob decode) with `const triggeredByUserId = auth.ctx.kind === 'user' ? auth.ctx.userId : null;`
- Self-resume (`selfInvokeResume`, line 976) sends `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`. `checkInternal` compares the bearer to that same env value in constant time, so the call returns `internal/service_role` and passes. Gateway `verify_jwt=true` also accepts the service-role JWT. The resume path is not otherwise attributed.

**5. check-auto-transcription** (guard: `requireUserOrInternal(req, ANY_ROLE)`)
- Replace the local `corsHeaders` (lines 4-7) with the shared import. Insert the guard after OPTIONS (line 12).
- After the `bookingId` missing check (line 17-22): `if (!(await canSeeBooking(auth.ctx, bookingId))) return jsonResponse(404, { error: 'Booking not found' });`. Internal callers always pass this check.
- The trigger path authenticates with `x-internal-secret`. The existing service-role call to `transcribe-call` (line 194) is unchanged.

**6. notify-moved-in** (guard: `requireUserOrInternal(req, ['super_admin'])`)
- Replace the local `corsHeaders` (lines 3-6) with the shared import. Insert the guard after OPTIONS (line 11).
- Attribution: not stored today and not added.
- config.toml: add the block below. No other entries change.
```text
[functions.notify-moved-in]
verify_jwt = false
```

## config.toml summary
- check-auto-transcription and cleanup-coaching-audio stay `false`.
- analyze-member-insights, analyze-non-booking-insights and generate-research-insights stay `true`.
- Only the notify-moved-in block is added.

## Deploy and verify
- Deploy the 6 functions.
- Call each with a POST using the anon key; expect 401 from all 6. For the three with `verify_jwt=true`, the anon JWT passes the gateway and the function then rejects it.
- Check the logs to confirm the 401s come from the function and no token is printed.

## Risks
- If the Vault secret the DB now sends doesn't match what `get_internal_function_secret()` returns, or is shorter than 32 chars, all cron jobs and both triggers start getting 401. I can confirm the length safely with `select length(public.get_internal_function_secret())` (read-only, service role) before deploying. I'll run it only if you approve.
- The P1 gateway "Invalid JWT" issue could affect the three functions that stay at `true` for app users. That's unchanged by this task, but if it shows up the fix is to set `false`, since the in-function guard is the real check.

## Out of scope
No changes to `src/**`, SQL, RLS, migrations, or any other function.
