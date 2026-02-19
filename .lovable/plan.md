
# Research Script Improvements: Call Termination & Yes/No Enforcement

## Problem Summary

Two issues need to be addressed in the research script wizard (both internal `LogSurveyCall.tsx` and public `PublicScriptView.tsx`):

1. **No "hang up" / termination escape hatch** — The researcher has no way to abruptly end the script mid-flow when the caller hangs up or stops cooperating. The only exit path is completing the full flow.

2. **Yes/No questions are skippable** — The `Next` button on `yes_no` type questions allows advancing without selecting an answer, despite the answer being critical for determining branching logic.

---

## Solution Design

### 1. Call Termination — "End Call" Disposition Button

A persistent **"End Call"** button will appear in the header/toolbar area of every script phase (after the call has started — i.e., past the `setup` phase). When clicked:

- A **confirmation dialog** (or inline panel) appears with a disposition selector:
  - "Caller Hung Up"
  - "Caller Asked to Stop"
  - "Wrong Number"
  - "Technical Issue"
- On confirm → the system records the partial responses collected so far, sets the `call_outcome` to the selected disposition, and jumps directly to the **wrapup phase** so the researcher can finalize and submit.
- The progress made (questions answered so far) is preserved in the submission.

This appears in **both** `LogSurveyCall.tsx` and `PublicScriptView.tsx`.

For `PublicScriptView.tsx` (the token-based external view), since there's no submit/wrapup flow, it will show a simplified "End Call" confirmation and go to the `done` phase with a "Call Ended Early" message instead of "Script Complete."

### 2. Yes/No Answer Enforcement

On `yes_no` type questions, the **Next button will be disabled** until the researcher selects Yes or No. This applies in both views.

Additionally, a subtle hint message will appear below the buttons: *"A Yes or No response is required to determine next steps."*

In `LogSurveyCall.tsx`, the `QuestionInput` component's `yes_no` branch already renders Yes/No buttons — the `Next` button (in the parent card) will check if a response exists for the current question and disable itself when the question type is `yes_no` and no answer is recorded.

---

## Files to Modify

### `src/pages/research/LogSurveyCall.tsx`

**Changes:**
1. Add a new `WizardPhase` value — no, the existing `wrapup` serves as the landing. We just need to pre-populate `callOutcome` and jump there.
2. Add a `handleEndCall(disposition: string)` function that:
   - Sets `callOutcome` to the chosen disposition
   - Sets `phase` to `'wrapup'`
3. Add an `EndCallButton` component (or inline trigger) — a red "End Call" button visible in a sticky top strip during active phases (`intro`, `consent`, `question`, `closing`, `rebuttal`).
4. Add a confirmation dialog using an `AlertDialog` from the existing UI library that shows disposition options before terminating.
5. Disable the `Next` button when `currentQ?.type === 'yes_no'` and `responses[String(currentQ.id)] === undefined`.
6. Show a small required hint under yes_no inputs.

### `src/pages/PublicScriptView.tsx`

**Changes:**
1. Add an `EndCallButton` in the sticky header that's visible from `intro`, `consent`, `question`, `closing`, `rebuttal` phases.
2. Add an `AlertDialog` confirmation with disposition options (simpler set: "Caller Hung Up", "Caller Asked to Stop", "Other").
3. On confirm → set a new `endedEarly` state flag + disposition text, then `setPhase('done')`.
4. Modify the `done` phase card to show a different message when `endedEarly` is true: "Call Ended Early" with the selected disposition shown.
5. Disable `Next` on `yes_no` questions until a response is selected.
6. Show required hint under yes_no radio group.

---

## Technical Details

### Disposition Options for LogSurveyCall (maps to existing `outcomeOptions`):
The existing outcome options already include `'no_answer'`, `'refused'` etc. We'll add two new options to the early-termination dialog that are contextually appropriate:
- "caller_hung_up" → label "Caller Hung Up"
- "caller_stopped" → label "Caller Asked to Stop"  
- "wrong_number" → label "Wrong Number"
- "technical_issue" → label "Technical Issue"

These map into the existing `callOutcome` string field that feeds into `call_outcome` on submission — no database schema changes needed.

### Yes/No Button Blocking Logic (LogSurveyCall):
```
const isNextDisabled = 
  phase === 'question' && 
  currentQ?.type === 'yes_no' && 
  responses[String(currentQ?.id)] === undefined;
```

### Yes/No Blocking in PublicScriptView:
```
const isNextDisabled =
  phase === 'question' &&
  currentQ?.type === 'yes_no' &&
  currentResponse === undefined;
```

### AlertDialog Usage:
Already installed via `@radix-ui/react-alert-dialog`. The existing `src/components/ui/alert-dialog.tsx` component will be used directly — no new dependencies needed.

---

## UI Placement

The "End Call" trigger will be placed as a **small red button in the top-right corner of the progress bar row** during active phases — keeping it accessible but not accidentally clickable. It uses a phone-off icon (`PhoneOff` from lucide-react) with the label "End Call."

```text
[ Introduction                    12% ] [ 📵 End Call ]
[████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]
```

---

## No Database Changes Required

All data flows into the existing `call_outcome` field on `research_calls`. The early termination disposition values are just new string values for that field — fully compatible with the existing schema.
