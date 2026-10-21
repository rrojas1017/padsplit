# CR-013 (C of 4) — Grid questions in the Script Builder and agent form

Frontend only. No backend functions, database, dashboards, Word brief, KPI configs or import dialog changes. No new dependencies. Nothing published.

## Data model (as decided)
- A grid is N consecutive `multiple_choice` rows that share the same `options` and carry `matrix: { group, title, row }`.
- Each row's `question` is `title + " — " + row`.
- Every row keeps its own `id` and `ai_extraction_hint`.
- `ScriptQuestion` (useResearchScripts) gains `matrix?: { group: string; title: string; row: string }`. The local `ScriptQuestion` interfaces in `PublicScriptView.tsx` and `LogSurveyCall.tsx` get the same field.

## New shared helper: `src/utils/scriptMatrix.ts` (pure, no imports from the app)
- `isValidMatrixRow(q)`: `type === 'multiple_choice'`, non-empty `matrix.group`, and `options.length >= 2`.
- `getMatrixBlock(questions, index)` → `{ start, end, group }`. It covers the consecutive run of valid rows with the same group around `index`, or returns null. Invalid rows render as normal questions.
- `snapToBlockStart(questions, index)` → the block's `start` when inside a grid, otherwise `index`.
- `matrixQuestionText(title, row)` → `"title — row"`, trimmed.
- `newMatrixGroup()` → `"g_" + 8 random base-36 characters`.
- `groupEditorBlocks(questions)` → a list of `{ kind: 'single', index }` or `{ kind: 'grid', start, end }`, used by both editors.

## 1. Script Builder (both editors)
Files: `ResearchScriptDialog.tsx`, `StepQuestions.tsx`, plus a new shared card `src/components/script-builder/GridQuestionCard.tsx` used by both editors. It uses only existing UI pieces: Card, Input, Badge chips, Button, Switch, Collapsible.

### Add and layout
- An "Add grid question" button sits next to every existing add-question button.
- A new grid is 3 rows ("Row 1".."Row 3"), columns Yes / Maybe / No, `required` true and a new group. Each row gets an id from `generateQuestionId()` (the same function new questions use today).
- The question list renders by `groupEditorBlocks`: a single question renders as today; a grid block renders one `GridQuestionCard`.

### Grid card editing
- **Title** sets `matrix.title` on every row and rebuilds each `question`.
- **Columns** use the same chip editor as options (add, remove; at least 2) and write one shared `options` array to all rows.
- **Rows** can be added, renamed, removed (at least 1; removing the last row removes the grid) and moved up or down within the grid.
  - Renaming rebuilds `question`. `id` and `ai_extraction_hint` are never touched.
  - A new row copies the grid's options, required and section, gets a new id and an empty hint, and is inserted inside the block.
- **Hints:** each row has an optional AI hint input inside a small Collapsible labelled "AI hints".
- **Section and Required** apply to every row.
- **Delete grid** removes the whole block. Neither editor has a delete confirm today, so this uses the same immediate delete.
- **Move up/down** moves the whole block past the neighbouring block (a single question or another grid), so nothing can land between grid rows. `order` is renumbered `i + 1` after every change, as today.
- **Duplicate** (wizard only): a single question still duplicates as today. A grid duplicate copies the block with a new group and new row ids.
- No branching controls in the grid card.

### Save mapping
In `ResearchScriptDialog` save and `StepUpload`:
- `matrix` is kept only when `type === 'multiple_choice'`, otherwise stripped.
- Rows with a `matrix` lose `branch`.
- Branch targets elsewhere in the script are left exactly as they are.

### AI prompt
`StepAIPrompt.tsx` prints `Grid: <title>` once before the first row of each block. Rows are already listed as multiple-choice questions with their options.

## 2. Agent runners
Every component that renders script question inputs for an agent:
1. `src/pages/PublicScriptView.tsx` (public agent form)
2. `src/components/research/ScriptTesterDialog.tsx` (tester)
3. `src/components/script-builder/StepPreview.tsx` (wizard preview)
4. `src/pages/research/LogSurveyCall.tsx` (in-app survey logger). It did not get multi-select in prompt B, so this prompt adds **both** grid and multi-select to it: checkbox rows in its existing row style, the "Select all that apply" / "Select up to N" helper, unticked boxes disabled at the limit, and an empty selection removes the answer.

No other runner exists. `ResearchScriptImportDialog` only edits scripts, and the dashboards are read-only.

### Grid screen behaviour (same in all four)
- When the current index is in a valid block, the runner snaps to `start` and shows the grid `title` once.
- Below the title is a table: the first column holds row labels, then one radio column per option. Headers come from the first row's options.
- On narrow screens each row stacks: the row label above a horizontal radio group.
- Each row is its own RadioGroup with the existing RadioGroupItem.
- Clicking a cell stores that row's own `options[col]` (a string) under the row's existing response key:
  - PublicScriptView: the stable key;
  - LogSurveyCall: `String(id)`;
  - tester and preview: the index.
- Clicking the selected cell again clears it.
- Spanish runs use the `questions_es` rows, so the stored value is the Spanish label as displayed, the same as multiple choice today.
- There is one agent-notes box keyed by the block's first row (PublicScriptView `String(start)`; elsewhere the existing notes key at `start`). The first row's probes are shown once.
- **Next** goes to `end + 1` (or closing/wrap-up when `end` is the last row) and ignores any branch on the rows. It pushes `start` onto the visited stack or set, so **Back** returns to the grid's first row.
- **Landing in the middle of a grid** (Back, a branch target, restore or resume) snaps to the block's `start`. This is applied wherever the runner sets the question index.
- **Progress text:** "Questions S–E of N" (1-based) on a grid screen, otherwise unchanged. The percentage uses the block's `end` so rows still count.
- Next is never blocked by unanswered rows.
- Save queue, payload, snapshots, dialer params and CR-012 outcomes are unchanged. Answers are ordinary multiple-choice values by key.

## 3. Translation (`src/hooks/useScriptTranslation.ts`)
- In both mapping spots (on-the-fly `translateScript` and `translateAndStore`): if the translated question has a `matrix`, keep it but force `group` from the source.
- If it has no `matrix` but the source does, copy the source's `matrix`. The server's translated title/row win when present.
- Ids and hints are carried over as today.

## 4. Not touched
Dashboards, `scriptSurveyAnalytics`, PE adapter, Word brief, KPI configs, `ResearchScriptImportDialog`, `scriptBranching.ts`, edge functions, database.

## Files
- New: `src/utils/scriptMatrix.ts`, `src/components/script-builder/GridQuestionCard.tsx`
- Edited:
  - `src/hooks/useResearchScripts.ts`
  - `src/components/research/ResearchScriptDialog.tsx`
  - `src/components/script-builder/StepQuestions.tsx`
  - `src/components/script-builder/StepUpload.tsx`
  - `src/components/script-builder/StepAIPrompt.tsx`
  - `src/pages/PublicScriptView.tsx`
  - `src/components/research/ScriptTesterDialog.tsx`
  - `src/components/script-builder/StepPreview.tsx`
  - `src/pages/research/LogSurveyCall.tsx`
  - `src/hooks/useScriptTranslation.ts`

## Acceptance (confirmed after build)
- `tsgo --noEmit -p tsconfig.app.json` clean.
- A script without `matrix` behaves exactly as before. All new paths only trigger on valid matrix rows.
- Builder: a 3-row Yes/Maybe/No grid saves as 3 consecutive multiple_choice rows with the same group and options, and `question = "title — row"`. Ids are kept after renaming a row or a column. This is checked with a small script that runs the helper and editor update functions on sample data.
- Runner: the grid is on one screen, each row stores its own label, and Back/Next skip the block. Spanish shows Spanish labels. Checked in the wizard preview with Playwright; no real survey is submitted.
- Nothing published.
