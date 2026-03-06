

## Investigation: Why Some Records Are Missing Survey Progress

### Findings

**Database stats:**
- 129 valid research records **have** survey progress
- **8 valid research records are missing it** (all have transcripts and `has_valid_conversation = true`)
- 2,440 invalid records have no progress — this is correct by design (voicemails, short calls)

**Root cause:** The 8 missing records were likely processed **before** the survey progress extraction code was deployed, or the AI call for progress extraction silently failed (no retry). The logs confirm zero "Extracting survey progress" entries for the most recent affected record (`2568aa5a`), meaning the code path was skipped or the edge function version running at the time didn't include it yet.

**The `backfill-survey-progress` function exists** and is designed to fix exactly this — it finds research records with transcripts but no `survey_progress` and runs the AI extraction. However, it has never been invoked (no logs).

### Plan

1. **Run the existing `backfill-survey-progress` function** to fill in the 8 missing records — no code changes needed. I'll invoke it directly to patch the gap.

2. **Add a defensive log line** in `transcribe-call/index.ts` at the survey progress gate (`if (isResearch && hasValidConversation && transcription)`) to always log when the condition is evaluated, so future skips are visible in logs rather than silently passing. Currently, the only log is inside the `try` block, so if the outer condition fails, nothing is logged.

### Files Changed
- `supabase/functions/transcribe-call/index.ts` — add debug log before the survey progress condition to trace skips

### Action
- Invoke `backfill-survey-progress` edge function to fix the 8 existing records

