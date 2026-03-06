

## Data-Driven Preventability Scoring

### Current State
The `preventability_score` (1-10) in Prompt B is determined entirely by AI judgment from the transcript and extraction. There's no cross-reference with actual system data about what PadSplit knew or did before the member left.

### Available Data for Cross-Referencing
The system already stores data that can inform preventability:
- **Prior bookings** (`bookings` table) — same `contact_phone`/`contact_email` shows history (rebookings, prior statuses, how long they were a member)
- **Contact communications** (`contact_communications` table) — emails/SMS sent to this member, showing whether outreach was attempted
- **Detected issues** (`bookings.detected_issues` JSONB) — tagged pain points from prior calls
- **Call transcriptions** (`booking_transcriptions`) — prior call analysis, agent feedback, QA scores
- **Research calls** (`research_calls`) — linked survey responses

### Approach
Modify `process-research-record/index.ts` to:

1. **Before Prompt B**, query the member's historical data using `contact_phone` or `member_name` from the extraction
2. **Build a "member history context" object** with:
   - Number of prior bookings and their statuses (moved in, cancelled, no-show)
   - Communications sent (count, types, dates)
   - Prior detected issues from other calls
   - Whether they were previously flagged as high-churn-risk
   - Time as a PadSplit member (first booking date → research date)
3. **Feed this context to Prompt B** as a new section: `--- MEMBER HISTORY (SYSTEM DATA) ---`
4. **Update Prompt B classification rules** to use this data:
   - If communications were sent addressing the issue → raise preventability (signals existed, action was taken but failed)
   - If NO communications were sent and issue was known → raise preventability (missed opportunity)
   - If member had multiple prior bookings → raise regrettability (engaged member)
   - If no prior system touchpoints exist for the issue → lower preventability (no visibility)
5. **Add a `preventability_data_factors` field** to the classification output showing which system signals influenced the score

### Changes

**File: `supabase/functions/process-research-record/index.ts`**

- Add `fetchMemberHistory()` helper that queries `bookings`, `contact_communications`, `booking_transcriptions`, and `detected_issues` for the member using phone/email/name match
- Call it after Prompt A (which extracts `phone_number` and `member_name`)
- Append the history context to the Prompt B user message
- Update `DEFAULT_CLASSIFICATION_PROMPT` to include data-driven preventability rules and the new `preventability_data_factors` output field
- The history lookup uses the service role client (already available), no RLS concerns

### Output Schema Addition
```json
"preventability_data_factors": {
  "prior_bookings_count": 2,
  "communications_sent": 3,
  "known_issues_before_departure": ["maintenance", "roommate_conflict"],
  "issue_was_previously_reported": true,
  "time_as_member_days": 180,
  "score_adjustment": "+2 (issue was reported but not resolved)"
}
```

This is a single-file change to the edge function. No schema changes needed — the new fields are stored inside the existing `research_classification` JSONB column.

