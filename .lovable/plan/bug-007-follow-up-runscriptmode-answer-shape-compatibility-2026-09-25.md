# BUG-007 follow-up — runScriptMode answer-shape compatibility

## Scope
One file: `supabase/functions/generate-research-insights/index.ts`, the `runScriptMode` per-record answer parser only (current lines 1136–1157). Nothing else.

## Root cause (verified)
`runScriptMode` reads `research_extraction.raw_script_answers` using only the **web-form** entry shape:
- open-ended: `a.raw_text_answer`
- choice/multi/yes_no: `a.selected_option_labels`, falling back to `[a.raw_text_answer]`
- scale: `a.scale_value`

Audio research calls processed by `process-research-record` store the **AI-extraction** shape (verified at `process-research-record/index.ts:1119–1124`):
```
{ answer_text: string|null, selected_options: string[], scale_value: number|null, source:'ai_extraction' }
```
For audio-only calls there is no web-form data (`mergedRaw = { ...aiMap, ...existingMap }`), so `raw_text_answer` and `selected_option_labels` are undefined. Open-ended and choice answers from audio calls are therefore skipped — tonight's job-9 summary for `script_827b23ef` would count only scale values from those calls.

## Change
Make the open-ended and choice branches accept **either** shape. Scale is unchanged (already reads `scale_value`, present in both shapes).

### Exact diff (replace lines 1146–1156)

Current:
```ts
      } else if (openAnswers[sid]) {
        const txt = typeof a.raw_text_answer === 'string' ? a.raw_text_answer.trim() : '';
        if (!txt) continue;
        s.n++;
        if (openAnswers[sid].length < 150) openAnswers[sid].push(txt.slice(0, 300));
      } else {
        const labels: string[] = Array.isArray(a.selected_option_labels) ? a.selected_option_labels : (a.raw_text_answer ? [String(a.raw_text_answer)] : []);
        if (!labels.length) continue;
        s.n++;
        for (const l of labels) s.counts[l] = (s.counts[l] ?? 0) + 1;
      }
```

New:
```ts
      } else if (openAnswers[sid]) {
        const txt =
          typeof a.raw_text_answer === 'string' && a.raw_text_answer.trim()
            ? a.raw_text_answer.trim()
            : typeof a.answer_text === 'string' && a.answer_text.trim()
              ? a.answer_text.trim()
              : '';
        if (!txt) continue;
        s.n++;
        if (openAnswers[sid].length < 150) openAnswers[sid].push(txt.slice(0, 300));
      } else {
        const labels: string[] =
          Array.isArray(a.selected_option_labels) && a.selected_option_labels.length
            ? a.selected_option_labels.map(String)
            : Array.isArray(a.selected_options) && a.selected_options.length
              ? a.selected_options.map(String)
              : typeof a.raw_text_answer === 'string' && a.raw_text_answer.trim()
                ? [a.raw_text_answer.trim()]
                : typeof a.answer_text === 'string' && a.answer_text.trim()
                  ? [a.answer_text.trim()]
                  : [];
        if (!labels.length) continue;
        s.n++;
        for (const l of labels) s.counts[l] = (s.counts[l] ?? 0) + 1;
      }
```

### Resolution rules implemented
- **open-ended**: text = `raw_text_answer` (non-empty trimmed string) else `answer_text` (non-empty trimmed string); skip if neither.
- **choice / multi / yes_no**: labels = `selected_option_labels` (non-empty array) else `selected_options` (non-empty array) else `[raw_text_answer]` if non-empty else `[answer_text]` if non-empty else skip. Each label stringified via `String(...)`.
- **scale**: unchanged — `scale_value`, numeric only; skip null/non-finite.

Web-form entries (`raw_text_answer` / `selected_option_labels`) still take precedence when present, so web submissions behave exactly as before.

## Unchanged (do not touch)
Record selection, paging (.range in 1000s), the `not_enough_records` / `no_new_records` gates, `survey_progress` totals (completed/ended_early/answered/total), `otherNotes` from call summaries, the prompt construction, model default (`google/gemini-2.5-flash`), temperature, `research_prompts` focus lookup, `callLovableAI`, `logApiCost`, report validation (`smValidateReport`), storage (`data.mode='script'`, `open_answers_count`), response shapes, and every other mode (move-out, audience, payment, resume). No other file. No DB/migration/RLS. No new dependencies. Do not publish.

## Acceptance
- A forced run for `campaign_type = script_827b23ef` counts audio answers in `stats.questions` (n > 0 for open-ended and choice questions answered in audio calls).
- Web-form submissions still counted exactly as before.
- `deno check` on `generate-research-insights` clean (only the 4 pre-existing errors remain).
- Frontend `tsgo` unaffected (no frontend file touched).

## Deploy + verify
Deploy only `generate-research-insights`. Run `deno check supabase/functions/generate-research-insights/index.ts`. Confirm an unsigned POST `{}` returns 401. Report changed line range.
