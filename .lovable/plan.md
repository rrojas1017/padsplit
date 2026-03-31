

## Store Spanish Translation for Audience Survey Script

### What happened
I already triggered the `translate-script` edge function and got a successful response with all 12 questions translated to Spanish. The translation quality looks excellent — natural, conversational Spanish appropriate for phone surveys.

### What needs to happen
Run a single SQL migration to update the `research_scripts` row with:
- `intro_script_es` — the translated intro
- `closing_script_es` — the translated closing  
- `rebuttal_script_es` — the translated rebuttal
- `questions_es` — the full 12-question array in Spanish
- `translation_status` — set to `'completed'`

### Files changed

| File | Change |
|---|---|
| Migration SQL | UPDATE `research_scripts` SET translated fields WHERE id = `12fd2184-68af-4502-9f8e-9fc9fcef1214` |

Single migration. No code changes. After this, the "ES Pending" badge will change to "ES Ready".

