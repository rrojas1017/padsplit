
# Add Contact Verification Step to Script Wizard

## What This Does

Inserts a new **"Contact Verify"** phase immediately after the agent fills in caller details (setup) and before the intro/consent script begins. On this screen, the agent:

1. **Confirms the caller's name** — reads it back to confirm they have the right person
2. **Confirms or updates the best callback number** — asks "In case the call gets cut, what's the best number to reach you?" with an editable field pre-filled from what was entered in setup

This happens in both the live wizard (`LogSurveyCall.tsx`) and the script tester (`ScriptTesterDialog.tsx`).

---

## Visual Design

A clean, card-style screen — consistent with other phases — with:

- A subtle `Phone` icon header label ("Confirm Contact Details")
- The caller's name displayed prominently in a read-back prompt box: *"Am I speaking with **[First] [Last]**?"*
- A Yes/No toggle for name confirmation (if No, they can type a corrected name)
- A callback number field, pre-filled with the phone entered in setup, with a prompt: *"In case the call gets cut, what's the best number to reach you back at?"*
- A "Confirmed — Start Script" button to proceed

The step tracker gains a new **"Verify"** node appearing before "Intro" (or "Consent" if no intro).

---

## Files to Modify

### 1. `src/components/research/StepTracker.tsx`
Add `'verify'` as a recognized step ID in `buildSteps`:
- Insert a `{ id: 'verify', label: 'Verify' }` step as the first node in the track
- Map `phase === 'verify'` to `activeIndex` on that node
- It shows as `complete` once the agent moves past it

### 2. `src/pages/research/LogSurveyCall.tsx`

**State changes:**
- Add `WizardPhase` union member: `'verify'`
- Add state: `verifiedPhone` (string, pre-filled from `callerPhone`)
- Add state: `nameConfirmed` (boolean | null)
- Add state: `correctedFirstName`, `correctedLastName` (strings, for if the name is wrong)

**Flow change:**
- `handleStartScript()` → goes to `'verify'` instead of `'intro'` or `'consent'`
- New `handleVerifyConfirm()` → saves verified phone + name corrections, then goes to `'intro'` or `'consent'`

**UI — new `verify` phase block** (inside the main card):
```
┌──────────────────────────────────────────────────────┐
│  📞 Confirm Contact Details                          │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │  "Am I speaking with John Smith?"              │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  Name confirmed?   [✓ Yes]   [✗ No — correct it]   │
│  (if No: First name ___  Last name ___ inputs)       │
│                                                      │
│  Callback number                                     │
│  [  (404) 555-0100          ]  ← editable            │
│  "In case the call gets cut, what's the best         │
│   number to reach you?"                              │
│                                                      │
│              [← Back]   [Confirmed — Start Script →] │
└──────────────────────────────────────────────────────┘
```

**Step tracker:** `buildSteps` called with `hasVerify: true` so "Verify" appears as the first step, active during this phase.

**Submission:** `verifiedPhone` replaces `callerPhone` in the `CallSubmission` payload so the confirmed callback number is what gets saved.

### 3. `src/components/research/ScriptTesterDialog.tsx`

**State changes:**
- Add `Phase` union member: `'verify'`
- Add state: `testerFirstName`, `testerLastName`, `testerPhone` (editable fields)
- Add state: `nameConfirmed` (boolean | null)

**Flow change:**
- "Start Test" button → goes to `'verify'` instead of `'intro'`/`'consent'`
- `handleBack()` from `intro`/`consent` → goes back to `'verify'`
- `restart()` resets all new state fields

**UI — new `verify` phase block:**
Same design as above but uses placeholder data (`"Test Agent"` name, empty phone pre-filled). Since this is a tester, the fields are clearly marked as simulation inputs. The "Confirmed — Start Script →" button advances to `intro` or `consent`.

**Step tracker:** `buildSteps` called with `hasVerify: true`.

### 4. `src/components/research/StepTracker.tsx` — `buildSteps` signature update

```typescript
export function buildSteps(params: {
  hasVerify?: boolean;   // NEW
  hasIntro: boolean;
  hasClosing: boolean;
  questions: unknown[];
  phase: string;
  questionIndex: number;
}): TrackerStep[]
```

Inserts `{ id: 'verify', label: 'Verify' }` as the first step when `hasVerify` is true.
Maps `phase === 'verify'` → `activeIndex` on that node.

---

## What Does NOT Change
- All branching / yes_no enforcement logic
- End Call button and AlertDialog
- Question rendering, probing follow-ups, section navigator
- Wrapup / submission flow
- The `callerPhone` field in setup remains the pre-fill source

## Behaviour Summary

| Action | Result |
|--------|--------|
| Agent completes setup → clicks "Start Script" | Goes to `verify` phase |
| Agent confirms name (Yes) + edits/confirms phone → "Start Script" | Moves to `intro` or `consent`, `verifiedPhone` stored |
| Agent clicks "Back" on verify | Returns to `setup` |
| Agent clicks "Back" on intro | Returns to `verify` |
| In tester: "Start Test" | Goes to `verify` simulation screen |
| Submission payload | Uses `verifiedPhone` (the confirmed number) instead of raw `callerPhone` |
