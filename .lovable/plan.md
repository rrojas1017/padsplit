

# Script Builder Wizard — Implementation Plan

## Current State

The Script Builder page already has:
- A working list view showing script cards with badges, actions, translation status
- `ResearchScriptDialog` (367 lines) — a dialog for creating/editing scripts with question builder, tabs for Details/Questions/Intro/Rebuttal/Closing
- `ResearchScriptImportDialog` — uploads .docx, sends to `parse-research-script` edge function for AI parsing
- `ScriptTesterDialog` (556 lines) — a full phone-style simulation with step-by-step question navigation, branching, timer, language toggle
- `useResearchScripts` hook — CRUD on the existing `research_scripts` table
- Existing DB schema: `research_scripts` table with `campaign_type`, `target_audience`, `questions` (JSONB array), `intro_script`, `closing_script`, `rebuttal_script`, `is_active`, translation fields

**What's missing**: The 5-step wizard flow, AI prompt generation/storage, and the Launch/Configure step with dialer integration info.

## Strategy

Rather than rebuilding what already works, enhance the existing page with a wizard mode that **reuses existing components** (import dialog, question editor logic, script tester) and adds the missing steps (AI prompt generator, launch/configure). Add 3 new columns to the existing table for the new fields.

## Database Changes

Add columns to existing `research_scripts` table (migration):

```sql
ALTER TABLE research_scripts
  ADD COLUMN IF NOT EXISTS script_type TEXT DEFAULT 'qualitative',
  ADD COLUMN IF NOT EXISTS ai_prompt TEXT,
  ADD COLUMN IF NOT EXISTS ai_model TEXT DEFAULT 'gemini-2.5-flash',
  ADD COLUMN IF NOT EXISTS ai_temperature NUMERIC(3,2) DEFAULT 0.2,
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Populate slug from campaign_type for existing records
UPDATE research_scripts SET slug = campaign_type WHERE slug IS NULL;
```

No new tables needed — questions stay in the JSONB `questions` column (already working).

## New Files

| File | Purpose |
|------|---------|
| `src/components/script-builder/ScriptWizard.tsx` | 5-step wizard container with step indicator and navigation |
| `src/components/script-builder/StepUpload.tsx` | Step 1: Upload .docx or start from scratch + script details (name, type, description, target audience, slug) |
| `src/components/script-builder/StepQuestions.tsx` | Step 2: Question builder — editable card list with drag reorder, type switching, branching rules, agent notes |
| `src/components/script-builder/StepAIPrompt.tsx` | Step 3: Auto-generated AI prompt in dark code editor, editable, with model/temperature config |
| `src/components/script-builder/StepPreview.tsx` | Step 4: Reuses `ScriptTesterDialog` logic inline (agent phone mockup + script flow map) |
| `src/components/script-builder/StepLaunch.tsx` | Step 5: Summary card, dialer integration info (script ID, webhook URL), save draft / launch toggle |
| `src/components/script-builder/QuestionCard.tsx` | Individual question editor card with type-specific inputs, branching, agent notes |

## Modified Files

| File | Change |
|------|--------|
| `src/pages/research/ScriptBuilder.tsx` | Add "wizard mode" state — when creating new script, show `ScriptWizard` instead of the old dialog. Keep existing list view and edit/delete/test functionality unchanged. |
| `src/hooks/useResearchScripts.ts` | Add `script_type`, `ai_prompt`, `ai_model`, `ai_temperature`, `slug`, `status` to the `ResearchScript` interface and CRUD operations |

## Component Details

### ScriptWizard.tsx
- Horizontal stepper: 5 numbered circles with labels (Upload → Questions → AI Prompt → Preview → Launch)
- State management: holds all wizard data in a single `wizardData` state object
- Step validation before advancing (Step 1: name + type required; Step 2: at least 1 question)
- "Back" / "Next" buttons at bottom of each step
- On final save, calls `createScript()` from the hook

### StepUpload.tsx
- Two-column layout: left = dropzone (accepts .docx/.txt, uses existing mammoth parsing logic from `ResearchScriptImportDialog`), right = form fields
- File upload extracts text and auto-parses questions (reuses `parseQuestionsFromText` logic)
- "Start from scratch" button skips upload
- Fields: name, script_type (qualitative/quantitative/mixed), description, target_audience, slug (auto-generated from name)

### StepQuestions.tsx
- Renders `QuestionCard` for each question
- Add/delete/duplicate/reorder (up/down arrow buttons)
- Supports types: open_ended, multiple_choice, rating_scale, yes_no, ranking
- Each card: editable question text, type dropdown, options list (for MC), scale min/max (for rating), required toggle, agent notes (collapsible), branching rules (collapsible)

### StepAIPrompt.tsx
- Auto-generates prompt from script name, type, and questions using `generateAIPrompt()` function
- Dark-themed code preview area (`bg-slate-900 text-slate-100 font-mono`)
- Editable textarea
- Model dropdown (Gemini 2.5 Flash default), temperature slider (0-1, default 0.2)
- "Regenerate" button

### StepPreview.tsx
- Left: phone-style mockup showing one question at a time with response inputs (adapted from ScriptTesterDialog rendering logic)
- Right: vertical question list showing flow with current question highlighted and branching arrows
- Navigation: prev/next, restart
- "Looks good → Proceed to Launch"

### StepLaunch.tsx
- Summary card: script name, type, question count, target audience, campaign tag
- Dialer integration section: Script ID (UUID), webhook URL (constructed from VITE_SUPABASE_URL), copy buttons
- "Save as Draft" and "Launch Script" buttons
- Active/Inactive toggle

## What's NOT Changing
- Existing list view, edit dialog, delete, test, translation, public link features
- Edge functions and data pipeline
- Audience Survey view
- Existing `research_scripts` table structure (only adding columns)

