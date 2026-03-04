

# Pre-translate Scripts on Save (Not Per-Call)

## Problem
The current approach translates on-the-fly each time a researcher starts a survey. The user wants translations generated once when a script is created/updated, stored alongside the English version, so researchers simply pick the language instantly.

## Approach

### 1. Database: Add translation columns to `research_scripts`
Add three new columns and a JSONB column for the translated content:
- `intro_script_es` (text, nullable)
- `closing_script_es` (text, nullable)  
- `rebuttal_script_es` (text, nullable)
- `questions_es` (jsonb, nullable) -- same structure as `questions` but in Spanish
- `translation_status` (text, default `'pending'`) -- tracks: `pending`, `translating`, `completed`, `failed`

### 2. Auto-translate on script save
When a script is created or updated (in `useResearchScripts.ts`):
- After the insert/update succeeds, fire the `translate-script` edge function in the background
- Store the translated content back into the `_es` columns
- Update `translation_status` to `completed`
- Show a toast: "Spanish translation generated" or "Translation failed" 

The existing `translate-script` edge function is reused as-is. A new wrapper in the hook handles writing results back.

### 3. Frontend: Script Builder shows translation status
In the Script list page (`ScriptBuilder.tsx`), show a badge per script indicating translation status (e.g., "ES: Ready" / "ES: Translating..." / "ES: Failed" with a retry button).

### 4. Survey wizard uses pre-translated content
Update `LogSurveyCall.tsx`, `PublicScriptView.tsx`, and `ScriptTesterDialog.tsx`:
- When researcher selects "Español", use `questions_es`, `intro_script_es`, etc. directly from the script data -- no API call needed
- If `_es` fields are null (translation failed/pending), fall back to on-the-fly translation as a safety net
- Remove the translation loading spinner in the normal case (instant switch)

### 5. Update `useScriptTranslation.ts`
Refactor to add a `translateAndStore` method that:
1. Calls the edge function
2. Writes results back to `research_scripts` via `.update()`
3. Updates `translation_status`

Keep the existing `translateScript` method as fallback for cases where stored translation is missing.

### 6. Research calls hook
The `useResearchCalls` fetch for campaigns already pulls `research_scripts(...)` -- expand the select to include the new `_es` columns so they're available in the wizard.

## Files Changed
- **Migration**: Add `intro_script_es`, `closing_script_es`, `rebuttal_script_es`, `questions_es`, `translation_status` to `research_scripts`
- **`useResearchScripts.ts`**: Auto-trigger translation after create/update, add `translateAndStore` logic
- **`useScriptTranslation.ts`**: Add `translateAndStore` method
- **`useResearchCalls.ts`**: Expand script select to include `_es` fields; use them when language is `es`
- **`LogSurveyCall.tsx`**: Use stored translations instead of on-the-fly; instant language switch
- **`PublicScriptView.tsx`**: Same
- **`ScriptTesterDialog.tsx`**: Same
- **`ScriptBuilder.tsx`**: Show translation status badge + retry button

