

# Fix Script Logic + Add Lead Capture Fields to Audience Survey

## Two Changes

### 1. Fix Q4 → Q5 branching logic
**Current problem:** Q5 asks "If you haven't seen PadSplit ads, where would you expect to see them?" but there's no conditional branch on Q4 — so Q5 shows even when the member said "Yes, I saw PadSplit ads."

**Fix:** Add a `branch` object on Q4 so that:
- If answer contains "Yes" (any of the 3 yes options) → skip Q5 (jump to Q6)
- If answer is "No, I haven't seen any" → show Q5 as-is

Since Q4 is `multiple_choice` (not `yes_no`), the current branch system only supports yes/no routing. We'll convert Q5 to be conditionally required based on Q4's answer by:
- Adding a `skip_if` field to Q5 that the script wizard checks: if Q4's answer starts with "Yes" → auto-skip Q5
- OR simpler: rephrase Q5 to work for both cases: **"Where would you like to see more PadSplit ads?"** — this works whether they've seen them or not, eliminating the contradiction entirely

**Recommended approach:** Rephrase Q5 to "Where would you most like to see PadSplit ads?" and make it required for everyone. This removes the logic conflict without needing new branching infrastructure for multiple_choice questions.

### 2. Add lead capture fields for video testimonial interest
Add a new final question (Q13) to the script that captures contact info for members interested in a video testimonial:
- Question: "Would you be open to being featured in a short PadSplit video testimonial sharing your experience?"
- Type: `yes_no`
- Branch: If Yes → show manual capture fields for Name, Email, Phone
- `ai_extraction_hint`: "video_testimonial_interest"

For the manual fields, add 3 follow-up questions gated behind the Yes branch:
- Q14: "Great! Can I get your full name?" (open_ended, section: "Lead Capture", `is_internal: false`)
- Q15: "And your best email address?" (open_ended)
- Q16: "And a phone number we can reach you at?" (open_ended)

These will be standard script questions that the researcher fills in during the call.

## Implementation

### File: Update script via database
Run an UPDATE on `research_scripts` to modify the `questions` JSON array for script `12fd2184-68af-4502-9f8e-9fc9fcef1214`:
- Change Q5 text from "If you haven't seen PadSplit ads before, where would you expect to see them?" → "Where would you most like to see PadSplit ads?"
- Change Q5 `required` from `false` to `true`
- Remove Q5 `ai_extraction_hint` reference to "Only ask if Q4 answer is No"
- Add Q13 (video testimonial yes/no) with branch `yes_goto: 14`
- Add Q14, Q15, Q16 (name, email, phone) in a "Lead Capture" section
- Update Q13 branch: `no_goto` → end of survey (closing script)

### File: No code changes needed
The script wizard (`LogSurveyCall`, `PublicScriptView`) already supports:
- `yes_no` questions with branching
- `open_ended` questions for free-text capture
- Sequential question rendering

The AI extraction pipeline will automatically pick up the new fields via `ai_extraction_hint`.

