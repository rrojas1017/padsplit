

# Review: Payment Experience Survey Script + 1-5 Rating Fix

## Script Upload Verification — `c701a243-1c66-425a-8f79-99a290ec5b6b`

**PadSplit Member Payment Experience Survey (Hybrid Quant + Qual)** uploaded successfully on Apr 22 with all 16 questions, intro/closing/rebuttal scripts, and section structure intact.

| Element | Status |
|---|---|
| Intro / Closing / Rebuttal | All present and well-formed |
| Question count | 16 (1 scale, 6 multiple_choice, 8 open_ended, 1 yes_no) |
| Sections | 6 logical sections preserved |
| Probes | Captured on every question (good detail) |
| Branching | 1 branch on Q8 → Q9/Q10 |
| `is_active` | **`false`** — script is saved but not yet live |
| AI Prompt | **Empty** — no extraction prompt set |
| Slug | **Empty** — falls back to `campaign_type = market_research` |

## Issues Found

### 1. Rating dashboard hard-coded to 1-10 (your specific concern)
Q10 ("How clear was the total cost to move in") is correctly stored as `type: "scale"`, but the rendering layer assumes every scale is 1-10:
- `DynamicQuestionCard.tsx` → histogram axis fixed to 1-10, key finding shows `Average score: X/10`
- `ScriptResultsOverview.tsx` → KPI card shows `{avgRating}/10`
- `QuestionCard.tsx` (builder) → type label hard-coded "Rating Scale (1-10)"

The schema has no `scale_max` field today. We need to add one.

### 2. Q9 branching is incomplete
Q8 (auto-pay yes/no) branches `no_goto: 10, yes_goto: 9` — but Q9 is "PRIMARY REASON for not enrolling," which is the **No** path. The Yes path should skip Q9, and after Q9 the flow should explicitly resume at Q10. Q9 itself is missing the `required: false` flag and isn't marked `branch_only`.

### 3. Q9 options don't match Q8 No-path probes
Q8's `no_probes` lists 7 reasons; Q9's `options` lists only 6 of them and adds none beyond. Minor — likely just missing "Other (specify)" capture.

### 4. Section name typos
- Q13: `"Policy awareness & hardship support PadSplit"` (extra word)
- Q14: `"Policy awareness & hardship support Host"` (extra word)
- Q16: `" flexible payments, dynamic due dates, and streamlined third-party payments"` (leading space, lowercase, sentence-as-section). Should be `"Recommendations"` or similar.

### 5. Missing AI extraction prompt
`ai_prompt` is empty. The processing pipeline uses per-question `ai_extraction_hint` (which you set well), but the master `ai_prompt` is what guides per-record extraction synthesis. Without it, the Research Insights dashboard for this script will show only raw question-by-question results — no thematic cross-question synthesis.

## Plan

### Part A — Add configurable scale max (1-5, 1-10, or NPS 0-10)

**Schema change** (`src/hooks/useResearchScripts.ts`):
- Add `scale_min?: number` (default 1) and `scale_max?: number` (default 10) to `ScriptQuestion`.
- Backward compatible — missing values default to existing 1-10 behavior.

**Builder** (`src/components/script-builder/QuestionCard.tsx`):
- When `type === 'scale'`, show a small Min/Max number-input pair (default 1 / 10).
- Update type label from `"Rating Scale (1-10)"` to `"Rating Scale"`.

**Dashboard rendering** (`src/components/research/DynamicQuestionCard.tsx`):
- Replace hard-coded `length: 10` histogram with `Array.from({ length: max - min + 1 }, ...)` driven by the question's `scale_min/scale_max`.
- Replace `Average score: X/10` with `Average score: X/{max}`.

**KPI** (`src/components/research/ScriptResultsOverview.tsx`):
- Avg Rating card shows `{avg}/{max}` using the question's max (or "mixed" if multiple scale questions with different maxes).

**One-time data fix**: Set `scale_max = 5` on Q10 of this script via SQL.

### Part B — Fix script structure issues

Update `c701a243-...` via SQL:
- **Q9**: set `required: false` and add comment that this is conditional. Add the missing 7th option (`"Other (specify)"`) and align with Q8 no_probes list.
- **Q8 branch**: add explicit `unsure_goto: 10` so the Unsure path doesn't fall through to Q9.
- **Section names**: trim "PadSplit"/"Host" suffixes off Q13/Q14 to keep section grouping clean (`"Policy awareness & hardship support"`). Rename Q16 section to `"Recommendations"`.
- **Q15 + Q16**: review currently truncated — confirm `options` and `probes` look correct (will surface in the diff for you to OK).

### Part C — Add AI extraction prompt

Draft a focused `ai_prompt` for this script aligned to the P0 priorities you mentioned (flexible payments, dynamic due dates, hardship protocol). Save it on the script and set `ai_model = google/gemini-2.5-flash`, `ai_temperature = 0.2` (already set).

Suggested prompt scope:
- Extract per-call: payment literacy score (composite of Q1-Q4 accuracy), top friction theme (Q11), auto-pay barrier category (Q8/Q9), hardship awareness gap (Q12-Q14), and one "wish" capability (Q16).
- Output structured JSON for the Research Insights synthesis.

### Part D — Verification before launch

After fixes:
1. Set `is_active = true` on the script.
2. Run `parse-research-script` once on a sample transcript to confirm Q10 renders as 1-5.
3. Confirm new "Member Payment Experience" entry appears in Research Insights campaign dropdown (auto-discovery via slug).
4. Generate slug `payment_experience` so the public link `/research/script/payment_experience` is shareable for your HEX dashboard team.

## Files to Change

| File | Change |
|---|---|
| `src/hooks/useResearchScripts.ts` | Add `scale_min` / `scale_max` to `ScriptQuestion` interface |
| `src/components/script-builder/QuestionCard.tsx` | Min/max inputs when type=scale; relabel type |
| `src/components/research/DynamicQuestionCard.tsx` | Dynamic histogram range + dynamic `/max` label |
| `src/components/research/ScriptResultsOverview.tsx` | Dynamic `/max` on Avg Rating KPI |
| `src/components/script-builder/StepPreview.tsx` | (if it renders scale preview) match new range |
| Migration / one-off SQL | Patch Q9, sections, Q8 branch, Q10 scale_max=5, slug, ai_prompt on script `c701a243-...` |

## Out of Scope

- HEX dashboard / external call list — you're handling that by end of week.
- Spanish translation — script is English-only today; auto-translation will fire when the script is activated (existing background flow).

