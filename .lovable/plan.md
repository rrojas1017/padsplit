# Security Fix P5: Authorize 6 batch functions

Scope: only the 6 functions below. No changes to src/**, SQL, RLS, migrations, config.toml, other functions, prompts, models or cost logic.

In every function the local `const corsHeaders = {...}` is replaced by the shared import from `../_shared/auth.ts`, and the guard `const auth = await <guard>; if (!auth.ok) return auth.response;` goes right after the OPTIONS return.

## Per function

| # | Function | Local corsHeaders removed | Guard after OPTIONS | config.toml (unchanged) |
|---|---|---|---|---|
| 1 | batch-generate-qa-scores | lines 4-7 | `requireUser(req, MANAGERS)` (after line 71) | false |
| 2 | batch-generate-qa-coaching | lines 5-8 | `requireUser(req, ADMINS)` (after line 55) | false |
| 3 | batch-process-research-records | lines 3-6 | `requireUserOrInternal(req, MANAGERS)` (after line 18) | true |
| 4 | bulk-transcription-processor | lines 9-12 | `requireUserOrInternal(req, ADMINS)` (after line 461) | true |
| 5 | batch-extract-lifestyle-signals | lines 4-7 | `requireUserOrInternal(req, ['super_admin'])` (after line 12) | false |
| 6 | reclassify-records | lines 3-6 | `requireUserOrInternal(req, MANAGERS)` (after line 96) | no block (gateway default) |

Details:
- **batch-extract-lifestyle-signals:** lines 28-52 change.
  - Removed: the `authHeader` read, the anon-client `getUser`, the `user_roles` lookup, and the 401/403 responses.
  - The condition `if (authHeader && !jobId)` becomes `if (!jobId)`. The job-creation branch (count, insert job, first self-invoke) is otherwise unchanged.
  - The guard now runs on every call, so a user call that sends a `jobId` must still be super_admin.
- **batch-generate-qa-coaching:** its fan-out to generate-qa-coaching-audio (lines 103-106) keeps the service-role bearer.
- **batch-generate-qa-scores:** no auth code exists today. It calls the AI gateway directly (line 163), with no other function call. Only the guard is added.

## Self-chain and function-to-function calls (verified in the code)

Every call below sends the service-role bearer, which `checkInternal` accepts:

- batch-process-research-records calls process-research-record (line 147-150) and itself (line 191-194). Both send `Authorization: Bearer ${supabaseServiceKey}`.
- bulk-transcription-processor calls transcribe-call (line 212-216) and itself (line 427-431). Both send `Bearer ${supabaseServiceKey}`.
- batch-extract-lifestyle-signals calls itself (line 96-101 and line 323-327). Both send `Bearer ${supabaseServiceKey}`.
- reclassify-records calls itself (line 277-280) with `Bearer ${serviceKey}`.
- batch-generate-qa-coaching calls generate-qa-coaching-audio (line 103-106) with `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`.

Functions 1 and 2 use `requireUser`, which rejects internal callers. Neither one calls itself, so nothing breaks.

## Deploy and test
Deploy the 6 functions. Then send each one an anon-key POST with body `{}`. Expected result: 401 for all 6, and nothing starts.

## Notes
- The app callers are already signed-in users with matching roles: QADashboard, Settings (Katty QA), ResearchInsights (batch + reclassify), useBulkProcessingJobs, and CrossSellOpportunitiesTab.
- Error messages change slightly: the lifestyle function's old 403 text "Forbidden: super_admin only" becomes the shared guard's standard 403 message.
- Only anon-key tests are possible from here, because preview auth is signed out.
