

# Populate Survey Progress for Research Records

## Problem
All 1,576 research records have `research_call_id = NULL` because they come from the automated dialer API, not the in-app survey tool. The nested join returns nothing, so the Progress column shows "—" for every row.

However, transcripts exist for 1,574 of these records, and there's a single research script with 36 questions. We can use AI to analyze each transcript and determine which questions were covered.

## Approach
Add a `survey_progress` JSONB column to `booking_transcriptions`, then:
1. Inject survey-progress extraction into the existing `transcribe-call` pipeline for future research records
2. Create a backfill function for the 1,574 already-transcribed records
3. Update the frontend to read from `survey_progress` instead of the broken `research_calls` join

## Changes

### 1. Database Migration
```sql
ALTER TABLE booking_transcriptions 
ADD COLUMN survey_progress jsonb DEFAULT NULL;
-- Structure: { "answered": 12, "total": 36, "questions_covered": [1, 3, 4, ...] }
```

### 2. `supabase/functions/transcribe-call/index.ts`
After the transcription analysis completes and before the upsert to `booking_transcriptions` (~line 1889), add a research-only step:
- If `isResearch && hasValidConversation`:
  - Parse campaign name from `bookingData.notes` (regex: `Campaign: (.+?) \|`)
  - Look up `research_campaigns` by name → get `script_id` → fetch `research_scripts.questions`
  - Call Lovable AI (gemini-2.5-flash) with the transcript + question list, using tool calling to extract which question numbers were covered
  - Store result as `survey_progress` in the upsert payload

### 3. `supabase/functions/backfill-survey-progress/index.ts` (new)
- Batch process existing transcribed research records (50 at a time)
- For each: fetch transcript from `booking_transcriptions`, run the same AI extraction, update `survey_progress`
- Use `EdgeRuntime.waitUntil()` pattern for background processing

### 4. `src/hooks/useReportsData.ts`
- Add `survey_progress` to the `booking_transcriptions` select join
- Read `questionsAnswered` and `questionsTotal` from `transcription.survey_progress` instead of the broken `research_calls` nested join
- Remove the unused `research_calls` nested join from the query

### 5. Reports UI
Already implemented — the Progress column rendering just needs data.

## AI Prompt Design
The AI will receive:
- The full transcript
- A numbered list of the 36 survey questions
- Tool calling schema to return `{ answered: number, total: number, questions_covered: number[] }`

Using `gemini-2.5-flash` for cost efficiency (~$0.0003 per call for this lightweight classification task).

## Cost Estimate
- Backfill: ~1,574 calls × ~$0.0003 = ~$0.47 total
- Ongoing: adds ~$0.0003 per future research record

