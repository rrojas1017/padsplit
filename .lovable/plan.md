

## Why Some Research Records Have Duration But No Progress Bar

**Root cause**: The progress bar requires `survey_progress` data in `booking_transcriptions`, which is extracted by AI after transcription. Records transcribed before this feature was added have a transcript (and duration) but no `survey_progress` — so the progress column is blank.

**The backfill function already exists**: `supabase/functions/backfill-survey-progress/index.ts` finds research records with transcriptions but null `survey_progress` and runs the AI extraction on them.

### Fix

1. **Invoke the existing backfill** — call `backfill-survey-progress` to process the missing records. This can be triggered from the backend functions with a simple POST request.

2. **Optionally add a UI trigger** — add a small admin button on the Reports page (or Research Insights page) that calls this backfill so you don't need to invoke it manually each time new gaps appear.

No code changes are strictly required — just running the backfill will populate the missing progress bars. Want me to trigger it, or add a UI button for it?

