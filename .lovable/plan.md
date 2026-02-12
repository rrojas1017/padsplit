

# AI Script Builder from Word Document + Interactive Preview/Test Mode

## Overview

Add two new capabilities to the Script Builder:

1. **AI Import from Word Document** -- Upload a .docx file containing questions, and AI automatically converts it into a ready-to-use research script (with intro, questions, rebuttal, closing all parsed out).
2. **Interactive Script Tester** -- A "Test Script" mode that simulates the exact Typeform-style flow the researcher will see, so admins can walk through the script before assigning it to a campaign.

## How It Will Work

### AI Document Import Flow

1. Admin clicks **"Import from Document"** button on the Script Builder page
2. A dialog opens with a file upload area (drag-and-drop or click to browse)
3. Admin uploads a .docx file containing their survey questions
4. The system extracts text from the Word document (using the `xlsx` library pattern already in the project, but we'll use a simple text extraction approach for .docx)
5. The extracted text is sent to an edge function that calls Lovable AI (Gemini) to parse it into structured script data: name, intro script, questions (with types auto-detected), rebuttal, and closing
6. The parsed result populates the Script Builder dialog so the admin can review, tweak, and save
7. AI auto-detects question types: lines with "1-10" or "rate" become scale, lines with bullet options become multiple choice, yes/no patterns become yes_no, everything else defaults to open_ended

### Interactive Script Tester

The existing Preview dialog gets upgraded to a full interactive simulation:
- Instead of a static list view, admins can click **"Test Script"** to walk through the exact same step-by-step wizard the researcher sees
- Shows intro with `{agent_name}` replaced by "Test Agent"
- Consent gate with Yes/No buttons
- Questions one-by-one with progress bar
- Closing script
- Rebuttal path (if they click No)
- A "Restart Test" button to go through it again

## Changes Required

### 1. New Edge Function: `parse-research-script/index.ts`

- Receives the raw text content extracted from the Word document
- Calls Lovable AI (google/gemini-3-flash-preview) with a structured prompt to parse the text into:
  - Script name (inferred from document title or first heading)
  - Intro script (opening greeting text)
  - Questions array (with auto-detected types and AI extraction hints)
  - Rebuttal script
  - Closing script
- Uses tool calling to return structured JSON output
- Returns the parsed script data to the frontend

### 2. Script Builder Page (`ScriptBuilder.tsx`)

- Add **"Import from Document"** button next to "New Script"
- Add `ScriptImportDialog` component inline or as a new component
- Add **"Test Script"** button on each script card (next to existing Preview/Edit/Delete)
- Replace the static `PreviewDialog` with an interactive `ScriptTesterDialog` that simulates the full agent flow

### 3. New Component: `ResearchScriptImportDialog.tsx`

- File upload UI with drag-and-drop support
- Accepts .docx files
- Extracts text from the .docx file on the client side (docx files are ZIP archives containing XML -- we'll use a lightweight extraction approach)
- Shows a loading state while AI processes
- On success, opens the existing `ResearchScriptDialog` pre-populated with the AI-parsed data so the admin can review and save

### 4. New Component: `ScriptTesterDialog.tsx`

- Reuses the same step-based wizard logic from `LogSurveyCall.tsx` but in a dialog
- Phases: intro, consent, questions (one at a time), closing, rebuttal
- Progress bar, large text, Next/Back buttons
- No actual data submission -- purely a walkthrough simulation
- "Restart" button to test again
- Shows exactly what the researcher will see

### 5. No Database Changes

The parsed document content flows directly into the existing `ResearchScriptDialog` form. No new tables or columns needed.

## Technical Details

### Word Document Text Extraction

Since the project already has the `xlsx` library for Excel parsing, we'll extract .docx text client-side. A .docx file is a ZIP containing `word/document.xml`. We can use a lightweight approach:
- Read the file as ArrayBuffer
- Use JSZip-style extraction (or a simple XML text strip) to get the raw text
- Send the plain text to the edge function for AI parsing

We'll add the `mammoth` npm package for reliable .docx-to-text conversion (lightweight, well-maintained).

### AI Prompt Strategy

The edge function prompt will instruct the model to:
- Identify the opening/greeting section as `intro_script`
- Identify numbered or bulleted questions
- Auto-detect question types based on context clues (scale keywords, option lists, yes/no patterns)
- Generate `ai_extraction_hint` values for each question
- Identify closing/thank-you sections as `closing_script`
- Generate a professional `rebuttal_script` if none is found

### Script Tester State Machine

Same as LogSurveyCall but simplified (no campaign selection, no submission):
```text
intro -> consent -> questions (1..N) -> closing
                 \-> rebuttal -> done
```

### Files to Create
- `supabase/functions/parse-research-script/index.ts` -- AI parsing edge function
- `src/components/research/ResearchScriptImportDialog.tsx` -- Upload + AI import dialog
- `src/components/research/ScriptTesterDialog.tsx` -- Interactive test/preview

### Files to Edit
- `src/pages/research/ScriptBuilder.tsx` -- Add import button, test button, wire new dialogs
- `package.json` -- Add `mammoth` dependency for .docx text extraction

### Implementation Order
1. Add `mammoth` dependency
2. Create `parse-research-script` edge function
3. Create `ResearchScriptImportDialog` component
4. Create `ScriptTesterDialog` component
5. Update `ScriptBuilder.tsx` to wire everything together

