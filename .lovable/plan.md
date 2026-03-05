

# Fix: Backfill Campaign Name Mismatch

## Problem
The backfill failed for all 91 records (`0 processed, 20 failed`) because the campaign name in the booking notes (`"Q1-Research-2026"`) doesn't match the actual campaign name in `research_campaigns` (`"Move in-out Researh: Member experience & Reason code Classification"`).

The regex extracts `"Q1-Research-2026"` from notes, then queries `research_campaigns` by name — no match found, so every record fails with "No questions found for campaign."

## Fix
Since there's only **one campaign** and **one script** (with 36 questions), simplify the backfill logic:

### `supabase/functions/backfill-survey-progress/index.ts`
Instead of parsing the campaign name from notes and looking it up, directly fetch the single research script's questions at the start of the function (outside the loop):

```typescript
// Fetch the single script's questions once
const { data: scriptData } = await supabase
  .from('research_campaigns')
  .select('research_scripts!research_campaigns_script_id_fkey(questions)')
  .limit(1)
  .maybeSingle();

const questions = scriptData?.research_scripts?.questions;
```

Remove the per-record campaign parsing and cache logic entirely. Use this single question list for all records.

### `supabase/functions/transcribe-call/index.ts`
Apply the same fix to the live pipeline — if campaign name lookup fails, fall back to fetching the first available research script's questions.

### After fix
Re-trigger the backfill. It will process all 91 records in ~5 batches.

