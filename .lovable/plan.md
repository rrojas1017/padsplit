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
