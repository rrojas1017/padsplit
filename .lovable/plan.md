

## Fix: Names Not Populating in Reports for Research Records

### Problem
Research records submitted via the Vici Dial API retain placeholder names ("API Submission - +1234567890") because:
1. No `research_calls` record exists for these calls (researchers don't use the script wizard for these)
2. The AI enrichment extracts `firstName: null` even when names are clearly spoken in the transcript (e.g., "Hi Jamie, this is Emily from PadSplit")
3. The prompt doesn't emphasize name extraction enough for research-style conversations where the researcher greets the caller by name

### Evidence
- Transcript for booking `e6ca0b37` starts with: *"Hi Jamie, hi. This is Emily from PadSplit"* — but `memberDetails.firstName` is `null`
- All 10 sampled Mar 6 records have `firstName: null` and `research_call_id: null`

### Solution

**File: `supabase/functions/transcribe-call/index.ts`**

1. **Enhance the AI prompt for research calls** — add a research-specific instruction block that emphasizes: "In research/survey calls, the researcher typically greets the person by name in the first few lines. Extract this name as firstName. The researcher is the PadSplit employee; the OTHER person is the member whose name you should extract."

2. **Add a regex fallback** after AI extraction — if `firstName` is still null and the record is research, scan the first 500 characters of the transcript for common greeting patterns like `"Hi [Name]"`, `"Hello [Name]"`, `"Hey [Name]"` where the speaker is the Agent/researcher. Use the captured word as the firstName.

**File: `supabase/functions/backfill-member-details/index.ts`**

3. **Add a third pass** — for research records where `member_name` is still a placeholder, apply the same regex greeting extraction against the transcript stored in `booking_transcriptions.call_transcription`.

### Scope
- `supabase/functions/transcribe-call/index.ts` — prompt enhancement + regex fallback
- `supabase/functions/backfill-member-details/index.ts` — transcript greeting scan pass

