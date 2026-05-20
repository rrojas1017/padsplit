## Bug

Scale sliders in both `ScriptTesterDialog.tsx` (test preview) and `PublicScriptView.tsx` (live survey) are hardcoded to `min=1 max=10`, ignoring each question's `scale_min` / `scale_max`. So a question authored as a 1–5 scale still lets the user drag up to 10.

## Fix

In both files, replace the hardcoded slider config with per-question values:

- `const min = currentQ.scale_min ?? 1;`
- `const max = currentQ.scale_max ?? 10;`
- Wire `min={min}` `max={max}` on `<Slider>`.
- Default the response to `min` (not `5`) when unset, and clamp existing responses into range so a stale value above the new max can't persist.
- Update the small min/max labels under the slider to render `{min}` / `{max}` instead of literal `1` / `10`.
- Same change to the `Response: …` label fallback.

No other behavior, schema, or branching logic changes.

### Files
- `src/components/research/ScriptTesterDialog.tsx` (~lines 414–422)
- `src/pages/PublicScriptView.tsx` (~lines 554–562)

### Acceptance
- A scale question with `scale_max = 5` caps the slider at 5 in both the test dialog and the public survey.
- Default 1–10 questions still behave as before.
