

# Add English/Spanish Language Toggle to Research Surveys

## Overview
Add a language selector at the start of each survey call so researchers can conduct the survey in Spanish. When Spanish is selected, all script text (intro, questions, consent prompt, closing, rebuttal) is automatically translated via AI at runtime -- no manual translation needed from admins.

## How It Works
1. **Language selector** appears in the Setup/Start phase of the survey wizard
2. When "Spanish" is selected, an edge function translates the script content using Lovable AI (Gemini Flash)
3. Translated content replaces the English text throughout the call flow
4. The selected language is recorded with the call submission for reporting

## Technical Plan

### 1. New Edge Function: `translate-script`
- Accepts: `{ intro, closing, rebuttal, questions[], targetLanguage: "es" }`
- Uses Lovable AI (google/gemini-3-flash-preview) to translate all text fields in a single request
- Returns the same structure with translated text
- Uses tool calling to extract structured output (translated questions array + script blocks)
- Caches nothing -- translates on demand per call (scripts are small, latency is acceptable since it runs before the call starts)

### 2. Frontend Changes

**LogSurveyCall.tsx** (internal researcher view):
- Add a language dropdown (`English` / `Espanol`) in the Setup phase, next to the campaign selector
- On "Start Script", if Spanish is selected, call the edge function and replace `introScript`, `closingScript`, `rebuttalScript`, and `questions[].question` / `questions[].options` with translated versions
- Show a loading spinner while translation runs
- Store `language: 'es'` in the call submission

**PublicScriptView.tsx** (Vici iframe view):
- Add language toggle in the Start phase card
- Same translation flow before entering the wizard

**ScriptTesterDialog.tsx** (admin test view):
- Add language toggle in the Start phase
- Same translation flow

### 3. Database Changes
- Add `language` column to `research_calls` table (text, default `'en'`, nullable)
- No changes to `research_scripts` table -- translations are generated on-the-fly

### 4. Call Submission
- `useResearchCalls` `CallSubmission` type gets an optional `language` field
- The language value is stored with each research call record

## User Experience
- Researcher sees "Language: English | Espanol" toggle before starting the call
- Selecting Espanol triggers a brief "Translating script..." loading state (2-3 seconds)
- All prompts, questions, options, and script blocks display in Spanish
- The consent prompt, navigation buttons, and UI chrome remain in English (only the read-aloud content is translated)

