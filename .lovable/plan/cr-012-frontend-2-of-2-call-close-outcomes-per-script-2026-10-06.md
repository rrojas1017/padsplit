# CR-012 (frontend, 2 of 2) — Call close outcomes per script

## Files touched
1. `src/hooks/useResearchScripts.ts`
2. NEW `src/components/research/CallOutcomesEditor.tsx`
3. `src/components/research/ResearchScriptDialog.tsx`
4. `src/components/script-builder/StepUpload.tsx` (only the `WizardData` type, which lives here)
5. `src/components/script-builder/ScriptWizard.tsx` (default value and save guard)
6. `src/components/script-builder/StepQuestions.tsx` (editor placement)
7. `src/pages/research/ScriptBuilder.tsx` (`handleWizardSave` passes `call_outcomes`)
8. `src/pages/PublicScriptView.tsx`
9. `src/hooks/useReportsData.ts`
10. `src/pages/Reports.tsx`
11. `src/components/research-insights/ScriptInsightsPanel.tsx` (Submissions tab only)

No edge functions, migrations, RLS, database, `types.ts`, `SCREEN_POP_QUERY`, API Docs, dashboards, routes or roles. No new dependencies. Nothing published.

## A. Data layer (`useResearchScripts.ts`)
- Export `interface CallOutcome { id: string; label: string; label_es?: string }`, and a pure `cleanCallOutcomes(list)`. It trims, drops rows with an empty English label, cuts both labels to 80, omits an empty `label_es`, keeps existing ids, gives new or empty ids `co_` + 8 random base-36 characters, and keeps at most 20.
- `ResearchScript.call_outcomes: CallOutcome[]`. In `fetchScripts`, an item without a string id and label is dropped, and a missing or non-array value becomes `[]`.
- `createScript` accepts an optional `call_outcomes`. The insert adds `call_outcomes: cleanCallOutcomes(script.call_outcomes ?? [])`, which old callers receive as `[]`, the column default.
- `updateScript`: when `updates.call_outcomes` is present, the payload gets the cleaned list. Translation triggers are unchanged; outcomes are not machine-translated.

## B. Editor
**`CallOutcomesEditor`** props: `{ value: CallOutcome[]; onChange(next) }`. It also exports `duplicateOutcomeLabels(list)`, which returns the indexes of case-insensitive duplicate trimmed English labels.
- **Rows:** each row has an English `Input` (maxLength 80, red border via `border-destructive` plus "Duplicate label" text when duplicated), a Spanish `Input` (maxLength 80, placeholder "Spanish (optional)"), and ghost icon buttons ChevronUp / ChevronDown / Trash2. These follow the same patterns as the dialog's question rows.
- **Add outcome:** the button (outline, sm, Plus icon) adds a row with a fresh `co_` id and is disabled at 20.
- **Add suggested outcomes:** shown only when the list is empty. It inserts the 8 suggested outcomes with their Spanish labels.
- **Hint line:** "Removing or renaming an outcome does not change past calls — they keep the label they were saved with."
- Renaming edits the label only, so the id is kept.

**Placement**
- **`ResearchScriptDialog`:** the editor goes in the "Call Scripts" tab, below Closing Script. The title is "Call close outcomes" and the helper text is as specified. State is initialised from `script.call_outcomes ?? []` and passed in `onSave` as `call_outcomes`.
- **Duplicates in the dialog:** they disable Save, and a `text-destructive` line reads "Two call close outcomes have the same English label — rename one before saving." The dialog's `onSave` type picks up the new field.
- **Wizard step:** step 2, **"Questions"** (`StepQuestions`, the "Intro & Closing" tab). The editor goes below Closing Script with the same title and helper text.
- **Wizard data and save:** `WizardData.callOutcomes: CallOutcome[]` (default `[]`; the import parser leaves it `[]`). Duplicates block "Next" from step 2 and both save buttons, with the same toast message. `handleWizardSave` passes `call_outcomes: wizardData.callOutcomes`.

## C. Agent form (`PublicScriptView.tsx`)
- `PublicScript.call_outcomes?: {id,label,label_es?}[]`; `hasOutcomes = (script?.call_outcomes?.length ?? 0) > 0`; `outcomeLabel(o) = surveyLanguage === 'es' && o.label_es ? o.label_es : o.label`.
- New state: `closeOutcomeId: string | null` (sent with saves), `pendingOutcomeId` (dialog selection, starts null), `endDialogOpen`.
- **`closeOutcomeId` in saves:** it is added to `snapshot`. In `send`, the body adds `...(s.closeOutcomeId ? { close_outcome_id: s.closeOutcomeId } : {})`. When nothing is chosen, which is always the case for scripts without outcomes, the body is byte-identical to today. Nothing else in `send`, `requestSave`, `save_seq`, generation/request ids or the timeout changes.

**When `hasOutcomes` is false**, the End Call dialog, Start and Done screens render exactly today's markup.

**When `hasOutcomes` is true:**
1. **End Call dialog:** it lists the outcomes in the same radio-row style as today, with nothing preselected. Its confirm button is disabled until a choice is made. Confirming calls `handleOutcomeEnd(o)`: set `closeOutcomeId = o.id`, `earlyDisposition = o.label` (English), `endedEarly = true`, then `phase = 'done'`. The existing done effect then sends the terminal save through the queue.
2. **Start screen:** below Begin Script there is an outline button "Close call without survey" that opens the same dialog, now controlled with `open` state. Confirming from the start screen also runs `setSubmissionId(crypto.randomUUID())` in the same state batch. Because the done effect fires only after that commit, `snapshotRef` already holds the id when the terminal save sends.
3. **Done screen:** a section "How did the call end?" lists the outcomes in the same row style.
   - **Before the terminal save succeeds:** the rows are disabled and the existing "Saving…" state shows.
   - **After End Call:** the chosen outcome is preselected and no request is sent.
   - **Selecting another outcome:** sends `supabase.functions.invoke('submit-public-script', { body: { token, submission_id, outcome_only: true, close_outcome_id } })` directly, not through the queue.
   - **Outcome request state:** `outcomeSaveState: 'idle'|'saving'|'saved'|'failed'`, `outcomeError`, and `outcomeSavedId`. It shows "Saving…", then "Outcome saved", or an inline error with a Retry button. For 409 "Submission expired" the message is "This call can no longer be edited". Other errors show the server's error text, and network errors show "Server error". The status and body are read through the same `FunctionsHttpError.context` pattern already in the file.
   - **Changing again:** the selection can change any number of times. A reply that arrives after a newer selection, or after Restart, is ignored via a request counter.
   - **Restart:** never blocked by this section. `doRestart` resets `closeOutcomeId`, `pendingOutcomeId` and the outcome request state.
- The outcome request never changes `terminalSaved`, `restartBlocked`, `saveState`, the save banner, or the beforeunload warning.
- Dialer sanitising, translation, question rendering and branching are untouched. The Done screen's existing "Disposition:" line stays and shows the English label.

## D. Where the outcome is shown
- **Reports, data source:** the intake badge comes from one batched lookup in `useReportsData.ts` (around lines 467–489). It runs `research_calls.select('id, kixie_link, source:responses->>_source').in('id', rcIds)` for the page's `bookings.research_call_id` values. That select gains `close_outcome_label`. A new `researchOutcomeById: Record<bookingId, string>` is filled in the same loop and returned from the hook.
- **Reports, badge:** in the research row in `Reports.tsx`, after the intake badge and before "Ended early", an `<Badge variant="outline" className="text-[10px] px-1.5 py-0">` shows the label, the same style as the intake badge.
- **Reports, CSV:** the research CSV gets a "Call Outcome" header after "Intake", with `researchOutcomeById[booking.id] || ''`. The CSV holds the current page's rows, the same as Intake.
- **Submissions tab:** the select gains `close_outcome_label`, and the row type gains `close_outcome_label: string | null`. The tab already has an "Outcome" column, which shows `call_outcome`, so the new column is headed **"Call outcome"**. It sits after "Early-end reason" and shows the label or "—". The existing Outcome, Early-end reason and Ended-early displays are unchanged.

## Not mapped exactly / notes
- **Column name:** the spec asks for a new "Outcome" column, but Submissions already has one. The new one is headed "Call outcome" so both stay.
- **Database types:** `types.ts` already lists `call_outcomes` and `close_outcome_*`, so these writes and selects need no type casts.
- **Wizard step:** the editor goes in step 2 "Questions", Intro & Closing tab. There is no separate scripts step.
- **Reports Records view:** the outcome badge and CSV column are on the Research view only, since only research rows have a research call.

## Verification
- `tsgo --noEmit -p tsconfig.app.json` clean.
- A browser check that a script without outcomes still shows the three fixed End Call reasons. No surveys are submitted, because that would write real rows.
