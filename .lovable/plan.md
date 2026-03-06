

## Fix: Populate Names on Research Records from Script Data

### Problem
Research records submitted via the Vici Dial API (`submit-conversation-audio`) get created with placeholder names like "API Submission - +1234567890". The script wizard (LogSurveyCall) collects first/last names and stores them in `research_calls.caller_name`, but these names never flow back to the corresponding `bookings.member_name` field. The transcription enrichment in `transcribe-call` attempts to extract names from transcripts but has a low success rate.

There are two gaps to fix:
1. **Script-submitted calls**: When a researcher logs a call via LogSurveyCall, a booking is created with the correct name — but if a matching API-submitted booking already exists (same phone number), it doesn't update the existing record's name.
2. **Post-transcription enrichment**: The name extraction in `transcribe-call` isn't reliably finding names. We should also cross-reference `research_calls` to backfill names.

### Solution

#### 1. Link research_calls names to bookings (new backfill + ongoing sync)

**File: `supabase/functions/transcribe-call/index.ts`**
- After transcription completes for a research record, check if there's a `research_calls` entry with the same `caller_phone` that has a real `caller_name`. If found, update `bookings.member_name`.

**File: `supabase/functions/backfill-member-details/index.ts`**
- Add a second pass: query `research_calls` for records where `caller_name` is a real name (not placeholder), then match to `bookings` by `research_call_id` or `contact_phone` and update `member_name` where it's still a placeholder.

#### 2. Fix the LogSurveyCall duplicate booking issue

**File: `src/hooks/useResearchCalls.ts`** (in `submitCall`)
- Before inserting a new booking, check if an API-submitted booking already exists for the same phone number (with `import_batch_id = 'api-submission'` and placeholder name). If found, update that existing record with the caller name and link the `research_call_id`, instead of creating a duplicate.

#### 3. One-time backfill of existing records

**File: `supabase/functions/backfill-member-details/index.ts`**
- Add logic to cross-reference `research_calls.caller_name` → `bookings.member_name` for all existing placeholder records, matching on `contact_phone`.

### Files Changed
- `src/hooks/useResearchCalls.ts` — update existing API-submitted booking instead of creating duplicate
- `supabase/functions/backfill-member-details/index.ts` — add research_calls cross-reference pass
- `supabase/functions/transcribe-call/index.ts` — after enrichment, also check research_calls for name data

