

# Typeform-Style Script Flow with Intro, Consent Gate, and Rebuttal

## Overview

Transform the survey call experience into a guided, conversational script flow. The script will include an **opening introduction**, a **consent check** (Yes/No gate), **dynamic questions** presented one at a time, and a **rebuttal/dismissal** path for when the caller declines.

## How It Will Work

### The Call Flow

```text
+----------------------------+
|   Step 1: SETUP            |
|   Select campaign + caller |
+----------------------------+
            |
            v
+----------------------------+
|   Step 2: INTRO SCRIPT     |
|   "Hello, my name is       |
|    [Agent Name], calling    |
|    from PadSplit..."        |
|   [Read Aloud to Caller]   |
+----------------------------+
            |
            v
+----------------------------+
|   Step 3: CONSENT GATE     |
|   "May I ask a few         |
|    questions?"              |
|   [ YES ]     [ NO ]       |
+----------------------------+
       |              |
       v              v
+----------------+  +-------------------+
| Step 4-N:      |  | REBUTTAL SCRIPT   |
| QUESTIONS      |  | "I understand,    |
| (one per       |  |  thank you for    |
| screen)        |  |  your time..."    |
|                |  | [End Call]        |
| [Back] [Next]  |  +-------------------+
+----------------+
       |
       v
+----------------------------+
|   CLOSING SCRIPT           |
|   "Thank you for your      |
|    feedback today..."       |
+----------------------------+
       |
       v
+----------------------------+
|   WRAP-UP                  |
|   Outcome, duration, notes |
|   [Submit Call]             |
+----------------------------+
```

## Database Changes

Add three new text columns to `research_scripts`:

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `intro_script` | text | null | Opening script text with `{agent_name}` placeholder |
| `rebuttal_script` | text | null | Script to read when caller declines |
| `closing_script` | text | null | Script to read after all questions are answered |

These are simple text fields -- no schema restructuring needed. The existing `questions` JSONB column stays the same.

## Changes Required

### 1. Database Migration
- Add `intro_script`, `rebuttal_script`, and `closing_script` text columns to `research_scripts`

### 2. Script Builder Updates (`ResearchScriptDialog.tsx` + `useResearchScripts.ts`)
- Add three new textarea fields in the Script Builder dialog:
  - **Intro Script**: with placeholder text showing the `{agent_name}` token usage
  - **Rebuttal Script**: what to say if the caller says no
  - **Closing Script**: what to say after completing all questions
- Update the `ResearchScript` TypeScript interface to include the new fields
- Update create/update functions to persist the new fields

### 3. Log Survey Call Redesign (`LogSurveyCall.tsx`)
Convert from single-page form to a step-based wizard:

- **Step 0 - Setup**: Campaign selection + caller info (name, phone, type, status) -- all on one screen
- **Step 1 - Intro Script**: Large, readable intro text with `{agent_name}` replaced by the logged-in researcher's name. Single "Next" button to proceed after reading
- **Step 2 - Consent Gate**: "Did the caller agree to continue?" with prominent Yes/No buttons
  - **If No**: Show the rebuttal script screen, then jump to wrap-up with outcome auto-set to "refused"
- **Steps 3..N - Questions**: One question per screen, displayed large for reading aloud
  - Open-ended questions: optional note field labeled "Quick notes (optional -- AI extracts from recording)"
  - Scale/multiple-choice/yes-no: quick-tap inputs, but "Next" is always enabled
  - Progress bar: "Question 3 of 8"
  - Back/Next navigation
  - Enter key advances
- **Step N+1 - Closing Script**: Display closing text for the researcher to read
- **Step N+2 - Wrap-Up**: Outcome, duration, researcher notes, Submit button

### 4. Script Preview Update (`ScriptBuilder.tsx`)
- Update the preview dialog to also show intro, rebuttal, and closing scripts so admins can see the full flow

### 5. Hook Updates (`useResearchCalls.ts`)
- Pass through the `intro_script`, `rebuttal_script`, `closing_script` from the joined `research_scripts` data so the form has access to them

## Technical Details

### Agent Name Substitution
The intro script text supports a `{agent_name}` placeholder. At render time in LogSurveyCall, it is replaced with the current user's profile name:
```text
"Hello, my name is {agent_name} and I'm calling from PadSplit..."
  becomes
"Hello, my name is Sarah Johnson and I'm calling from PadSplit..."
```

### Step State Machine
```text
currentStep values:
  0 = Setup (campaign + caller info)
  1 = Intro Script
  2 = Consent Gate
  3..N = Individual questions (index = currentStep - 3)
  N+1 = Closing Script
  N+2 = Wrap-up

If consent = NO:
  Jump to Rebuttal screen -> then Wrap-up (outcome = "refused")
```

### Files to Edit
- `src/hooks/useResearchScripts.ts` -- add new fields to interface
- `src/hooks/useResearchCalls.ts` -- include new script fields in campaign fetch
- `src/components/research/ResearchScriptDialog.tsx` -- add intro/rebuttal/closing textareas
- `src/pages/research/ScriptBuilder.tsx` -- update preview to show new fields
- `src/pages/research/LogSurveyCall.tsx` -- full redesign to step-based wizard

### Implementation Order
1. Database migration (add 3 columns)
2. Update `useResearchScripts.ts` interface + CRUD
3. Update `ResearchScriptDialog.tsx` with new fields
4. Update `ScriptBuilder.tsx` preview
5. Update `useResearchCalls.ts` to pass script text fields
6. Redesign `LogSurveyCall.tsx` as step-based wizard
