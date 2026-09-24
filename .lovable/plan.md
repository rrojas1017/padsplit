# P5-SEC: SEC-31 (internal continuation paths) + SEC-09 (verify the JWT in user functions)

Scope: 5 functions (generate-research-insights, bulk-transcription-processor, create-user, delete-user, update-user-role). `_shared/auth.ts` is not changed. No migrations, RLS or config changes. Nothing is published.

## SEC-31: continuation paths become internal-only

### generate-research-insights
- **How continuation is detected today:** the body has `resume: true` (line 988).
- **Current guard:** `requireUserOrInternal(req, MANAGERS)` (line 976) runs before the body is read, so a manager's token can call `{resume:true, insightId, chunkIndex, totalChunks}` directly.
- **Self-call today:** `selfInvokeResume` (lines 938-966) sends `Authorization: Bearer <service-role key>`. `checkInternal` already accepts that, so the chain works.
- **Fix:**
  - Inside the `if (body.resume)` branch (line 988), add a guard first. If `auth.ctx.kind !== 'internal'`, return 403 `{error:'Forbidden'}` with CORS headers.
  - The normal entry path keeps `requireUserOrInternal(req, MANAGERS)` unchanged.
  - The self-call keeps the service-role bearer, which passes as internal. No header change is needed, because `_shared/auth.ts` does not export the secret, so the bearer is the helper-supported internal credential.
- **Attribution:** already comes from `auth.ctx` (line 1010), with no `atob`. No change needed.

### bulk-transcription-processor
- **How continuation is detected today:** `action: 'continue'` in the body (`switch` case at line 572).
- **Current guard:** `requireUserOrInternal(req, ADMINS)` at line 460 lets an admin token send `continue`.
- **Self-call today:** lines 424-434 send `Authorization: Bearer <service-role key>`, which is accepted as internal.
- **Fix:** at the top of `case 'continue'` (line 572), if `auth.ctx.kind !== 'internal'`, return 403 `{error:'Forbidden'}`.
- **Unchanged:** `start`, `pause`, `resume` and `stop` keep the ADMINS guard. The self-call stays as is.

## SEC-09: replace `atob` decoding with `requireUser`
In all three functions:
- Delete the local `decodeJWT` (create-user lines 12-22; delete-user and update-user-role lines 8-18).
- Replace the header, decode and role lookup blocks with `requireUser(req, <roles>)`.
- Import `requireUser`, the role lists and `adminClient` from `../_shared/auth.ts`.
- `requestingUserId` becomes `auth.ctx.userId`, and the caller's role becomes `auth.ctx.role`.
- Each function keeps its own local `corsHeaders`.

| Function | Lines replaced | Roles (same as today) | Extra rules kept exactly |
|---|---|---|---|
| create-user | 72-117 (header, decode, `user_roles` lookup and 403) | MANAGERS (super_admin, admin, supervisor) | Supervisor must have a site (118-136); supervisor may only create agents (207); only super_admin creates admin/super_admin (216); supervisor site checks (227, 277) |
| delete-user | 27-83 | ADMINS | No self-deletion (105); only super_admin deletes a super_admin (113-124) |
| update-user-role | 26-75 | ADMINS | No changing your own role (98); admin-only restrictions from line 122 on; site required for supervisor/agent |

**Logging clean-up (same files):**
- Remove the logging of the requester's email: delete-user line 55, update-user-role line 53.
- create-user: the logs at lines 163, 190 and 287 print an email or name. Change them to print only the role or id.

## Differences a legitimate caller could notice
- **Wording of refusals only:** status codes stay the same (401 for no or invalid token, 403 for wrong role), but the refusal text becomes the shared `{error:'Unauthorized'}` / `{error:'Forbidden'}`. Before, each function had its own wording, such as "Insufficient permissions" or "Only super admins and admins can change user roles". Success responses and all business-rule errors are unchanged.
- **Signed-out users now get 401:** an expired or forged token used to pass the `atob` decode and is now rejected (the intended fix).
- **Inactive accounts are now refused:** `requireUser` rejects accounts marked inactive with 403. The old code didn't check this.
- **Users with more than one role:** the old lookup `.single()` failed for them. Their highest role is now used.

## Verification
- `deno check` on the 5 functions.
- Deploy the 5.
- Send an unsigned POST {} to each and expect 401. I will also report whether each 401 came from the function's own guard or from the platform's sign-in check.
- No other calls.
