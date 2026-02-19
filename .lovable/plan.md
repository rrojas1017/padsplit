
# Root Cause & Fix

## What's Actually Happening

The features (End Call button + yes/no enforcement) **were correctly implemented** in `LogSurveyCall.tsx` and `PublicScriptView.tsx`. However, the user is testing through the **"Test Script" dialog** (`ScriptTesterDialog.tsx`) that opens when clicking the test/preview button on the Script Builder page (`/research/scripts`). This is an entirely separate wizard component that was never updated.

The session replay confirms this — the user was on `/research/scripts` clicking Yes/No/Next inside a dialog modal, which is the `ScriptTesterDialog`. That component has no End Call button and no yes/no blocking.

## Files to Modify

### `src/components/research/ScriptTesterDialog.tsx`

This is the only file that needs updating. Two changes:

**1. End Call Button**
- Add `PhoneOff` to imports from lucide-react
- Add `AlertDialog` imports from the UI library
- Add state: `endedEarly`, `earlyDisposition`, `selectedEndDisposition`
- Add `handleEndCall(disposition)` function that sets early termination state and goes to `done` phase
- Add the End Call button in the progress bar row (same pattern as the other two wizards) — visible during all active phases (`intro`, `consent`, `question`, `closing`, `rebuttal`)
- Update the `done` phase to show "Call Ended Early" + disposition when `endedEarly` is true
- Update `restart()` to reset the new state fields

**2. Yes/No Enforcement**
- Disable the `Next` button when `currentQ.type === 'yes_no'` and `responses[questionIndex]` is `undefined`
- Add the required hint text below the yes/no radio group: *"A Yes or No response is required to determine next steps."*

## No Other Files Need Changes

`LogSurveyCall.tsx` and `PublicScriptView.tsx` already have all the correct changes from the previous implementation. Only `ScriptTesterDialog.tsx` is missing the updates.

## Technical Details

The End Call button appears in the progress bar row at the top right, using an `AlertDialog` with disposition options:
- Caller Hung Up
- Caller Asked to Stop  
- Other

The yes/no block disable condition:
```
disabled={currentQ.type === 'yes_no' && responses[questionIndex] === undefined}
```

This matches the pattern already used in `PublicScriptView.tsx` exactly.
