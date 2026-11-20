# CR-021 Phase A: "Other" detail from the transcript (dry run only)

## What you get
A preview of what the AI would fill in as the "Other" detail, for 10 calls: all 7 Member Screening calls and the 3 most recent Non-Booking calls. You get a table (booking id · question · proposed text or "—") plus the tokens and cost for those 10. Nothing is saved anywhere.

## Files
1. **New: `supabase/functions/_shared/otherDetail.ts`**
   - `findOtherQuestions(rawAnswers, questions)` (pure): takes the call's stored answers and the script's questions. It returns the questions where "Other" is selected, no `other_text` exists, and the question lists a literal "Other" option.
   - `extractOtherDetails({ apiKey, model, transcript, items })`: makes one AI call per booking through the same gateway that `process-research-record` uses, returning JSON. Each result is `{question_id, other_text|null}`.
   - Clean-up applied to every result: trim it, cap it at 200 characters, strip emails and phone numbers. A result that comes back empty becomes `null`.
   - Prompt rules:
     - Use only what the caller said in answer to that question, as close to word for word as possible.
     - Keep the transcript's language.
     - No interpretation and no agent words.
     - No names, phone numbers, emails or addresses.
     - Return `null` when the transcript has no clear answer.
   - Returns the token counts too. It writes no cost row itself.
2. **New: edge function `supabase/functions/fill-other-details/index.ts`**
   - Who can run it: super_admin and admin only, checked with `requireUser(req, ADMINS)`.
   - Request body: `{ dry_run?: boolean (default true), booking_ids?: string[], limit?: number ≤ 20 }`.
   - In this phase, `dry_run: false` is refused with 400 "not enabled in Phase A". So no write path exists yet.
   - Which calls it picks: valid research calls of the Member Screening and Non-Booking scripts with a completed transcript over 200 characters, where at least one answer has "Other" selected and no detail.
   - What it reads: data only, through the admin client on the server.
   - What it returns: per booking, a list of `{question_id, question_text, other_text}`, plus total input/output tokens and the cost estimated with the existing price list in `_shared/costs.ts`.
   - Model: the script's own AI model (today `gemini-2.5-flash`, normalized to `google/gemini-2.5-flash`), the same as process-research-record.
   - Logging: codes and counts only. No transcript text, no answers, no names or phones.
   - No `api_costs` row in dry run, because that would be a database write. Phase B will log `research_other_detail` rows.

## How I run the dry run
1. Deploy the function. Check that a POST with no sign-in returns 401.
2. Pick the 10 booking ids with a read-only database query: the 7 Member Screening calls plus the 3 most recent Non-Booking calls that meet the rules.
3. Call the function with your signed-in admin session, sending `dry_run: true` and those ids.
4. Confirm nothing changed: compare the row counts and the latest `updated_at` on the related tables before and after.

## Not changing
- Any table or row
- The agent form, `submit-public-script` and `process-research-record`
- Dashboards and Reports
- The frontend: no files touched

Nothing is published.

## Verification
`deno check` on both new files, a deploy, an unsigned POST returning 401, then the dry run itself. I'll report the changed files.
