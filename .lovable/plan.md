# P-A — Research call logging fixes (4 frontend files only)

Scope: LogSurveyCall.tsx, useResearchCalls.ts, rawScriptAnswers.ts, MyCallHistory.tsx. Existing exports, props, columns and edge-function fields are unchanged. No migrations, RLS, config.toml, edge-function changes or new dependencies. Not published.

## 1. src/pages/research/LogSurveyCall.tsx
- **Lines 197-200 (`questions` useMemo):** map the source array to `{ ...q, id: (q.id ?? '') !== '' ? q.id : \`q_idx_${index}\`, text: q.question ?? q.text ?? '' }`.
- **Line 915:** `{currentQ.question ?? currentQ.text}`.
- **Line 955:** yes-branch probe writes use `setProbeNote(\`${currentQ.id}_yes\`, idx, note)`.
- **Line 964:** no-branch probe writes use `setProbeNote(\`${currentQ.id}_no\`, idx, note)`. `setProbeNote` already accepts `string | number`. Line 923 (the main-question probes) is unchanged.
- **Line 498:** `navigate('/research/history')`. That route exists in App.tsx at line 332.
- **Lines 425-439 (handleSubmit):**
  - When `nameConfirmed === false` and a corrected first or last name was entered, use the corrected names; otherwise keep the originals. This applies to `caller_name`, `caller_first_name` and `caller_last_name`.
  - When `callDurationMinutes` is empty and the timer ran, use `Math.round(elapsedSeconds / 6) / 10` minutes (rounded to 0.1) for `call_duration_seconds`.
- **Wrap-up step (lines ~1072-1074):** prefill the Duration field with the same value when it is empty on entering wrap-up. This uses a small effect on `phase === 'wrapup'`, so the researcher sees and can edit the value.

## 2. src/hooks/useResearchCalls.ts (submitCall)
- **Step 1** (insert into research_calls, up to line ~246): unchanged.
- **Delete step 2** (lines ~247-308: booking select/update/insert and its try/catch).
- **Step 3 (lines ~310-331):** always build `rawAnswers` (`{}` when there are no script questions). Always call `supabase.functions.invoke('persist-research-raw-answers', { body: { research_call_id, raw_script_answers: rawAnswers } })`. If there's an `error` or the call throws, show `toast.warning('Call saved, but it could not be linked for AI analysis')`. The success toast and the `true` return stay as they are.
- `user` is still used in step 1, so it stays.

## 3. src/utils/rawScriptAnswers.ts (lines 111-119, `yes_no`)
Before the string logic: `if (typeof answer === 'boolean') label = answer ? 'Yes' : 'No'`. Otherwise use the existing string parsing unchanged.

## 4. src/pages/research/MyCallHistory.tsx (lines ~145-152)
- Build a lookup from `myCampaigns` (already returned by `useResearchCalls` on line 22): campaign_id → question label map. Keys are `String(q.id)`, plus `q_idx_<i>` and `String(i)` as fallbacks. Label is `q.question ?? q.text`.
- When listing responses:
  - skip keys starting with `_`
  - show `true`/`false` as Yes/No, and arrays joined with ", "
  - label each answer with the question text when found, otherwise `Q{key}` as today
- Only render the Responses block when at least one visible entry remains.

## Verification
Typecheck with `tsgo --noEmit -p tsconfig.app.json`, then report.
