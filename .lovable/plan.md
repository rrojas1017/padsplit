# P-G2 — Frontend cleanup (7 files)

Frontend only. No edge function, migration, RLS or config changes, no new dependencies, and nothing published.

## 1. src/pages/Settings.tsx
- Delete line 85 (`isGeneratingAudio` state).
- Delete lines 91-118 (`handleBatchGenerateAudio`).
- Delete lines 392-425, the "Coaching Audio Generation" card from its comment through the closing `</div>`.
- Remove the `Volume2` and `Zap` icon imports. Each is used only by that card, so both become unused. `Loader2` stays because the retry card uses it.
- The "Retry failed transcriptions" card and everything else stay untouched.

## 2. src/components/ai-management/LLMComparisonPanel.tsx
Lines 244 and 260: `'deepseek-chat'` → `'deepseek-v4-flash'`. Nothing else changes.

## 3. src/components/research-insights/MemberDetailPanel.tsx (XSS fix)
- Lines 167-171: `highlightText` now returns React nodes instead of an HTML string:
  - No search term: return `text`.
  - Otherwise: build an escaped regex with a capture group and the `gi` flags, then `text.split(regex)`. Odd-index parts render as `<mark key={i} className="bg-yellow-200 rounded px-0.5">{part}</mark>`; even parts render as plain text in a Fragment.
- Lines 316-319: `<p className="text-sm text-foreground leading-relaxed">{highlightText(line.text)}</p>` replaces the `dangerouslySetInnerHTML` version.
- Check: `grep -rn dangerouslySetInnerHTML src` should show only chart.tsx and SendEmailDialog.tsx.

## 4a. Save the wizard's AI and type fields
- **src/pages/research/ScriptBuilder.tsx, lines 82-92:** add `script_type: wizardData.scriptType || null`, `slug: wizardData.slug || null`, `ai_prompt: wizardData.aiPrompt || null`, `ai_model: wizardData.aiModel || null`, `ai_temperature: wizardData.aiTemperature ?? null`.
- **src/hooks/useResearchScripts.ts, lines 119-131 (createScript insert):** add these fields only when they are provided (`!== undefined`): `script_type`, `slug`, `ai_prompt`, `ai_model`, `ai_temperature`. Other callers that omit them keep the database defaults.
- `updateScript` (line 150) already passes every field through, so it drops nothing and needs no change.

## 4b. src/components/script-builder/StepUpload.tsx
Delete line 24 (the `move_out_survey` option). No default value refers to it.

## 4c. src/components/script-builder/StepAIPrompt.tsx
- Lines 109-112: replace the render-time `onChange` with:
  ```ts
  useEffect(() => { if (!data.aiPrompt) onChange({ aiPrompt: generateAIPrompt(data.name, data.scriptType, data.questions) }); }, [data.aiPrompt]);
  ```
  The comment keeps its intent. The dependency list is deliberately just `data.aiPrompt`, so the prompt only generates when it is empty.
- Line 1: import `useEffect`.

## Verification
- `npx tsgo --noEmit -p tsconfig.app.json` must pass clean.
- The `dangerouslySetInnerHTML` grep above.
- Report the results.
