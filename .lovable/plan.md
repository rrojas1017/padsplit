

## Make the Human Review Queue Actionable

Currently the 33 flagged items are listed with a name, date, reason code, and a truncated review reason — but admins can't do anything with them. Here's the plan to make it useful:

### What each review item needs

Each row should let the admin:
1. **Expand to see full context** — the AI's review reason (why it was flagged), the assigned reason code, and key quotes from the transcript
2. **View the transcript** — link/button to open the full call transcript
3. **Approve or Override** — confirm the AI's classification is correct, or pick a different reason code
4. **Dismiss** — mark as reviewed (clears the `research_human_review` flag) so it leaves the queue

### Implementation

**1. Redesign `HumanReviewQueue.tsx`**
- Convert each row into an expandable accordion-style card
- Expanded view shows: full `human_review_reason`, the AI's `primary_reason_code`, confidence score, and key quotes from `research_classification`
- Add action buttons: "Approve" (clears flag), "Override" (opens reason code selector, saves new code, clears flag), "View Transcript" (opens the existing `TranscriptionModal`)
- Add a "Dismiss" option that simply clears the review flag without changing classification

**2. Add review actions**
- **Approve**: Sets `research_human_review = false` on the record (keeps existing classification)
- **Override**: Updates `research_classification.primary_reason_code` with admin's selection and sets `research_human_review = false`
- Both actions update the record via Supabase and remove the item from the queue in the UI
- Show a toast confirmation after each action

**3. Add bulk actions**
- "Approve All" button to clear all flags at once (with a confirmation dialog)
- Counter updates in real-time as items are resolved

**4. Update processing stats**
- After approving/dismissing items, refresh the `humanReviewCount` in the parent stats banner so the amber "33 flagged" card updates

### Technical details
- Queries use existing `booking_transcriptions` table — no schema changes needed
- The `research_human_review` boolean column already exists for toggling
- The `research_classification` JSONB column holds the reason code to override
- Reason code options can be derived from the existing reason code distribution data or a static list

