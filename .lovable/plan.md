# Retry transcription for 5/19 payment-experience calls

## Diagnosis confirmed

For `record_type = 'research'`, `booking_date = 2026-05-19`, `campaign_type = payment_experience`:

| transcription_status | count | cause |
|---|---|---|
| completed | 288 | already transcribed |
| failed (`AI summary error: 402`) | **245** | **Lovable AI credits exhausted — retryable now** |
| failed (`STT returned empty transcript`) | 219 | silent/voicemail audio — NOT retryable, will just fail again |
| failed (other: timeout / connection closed) | 2 | transient — could retry |

The 245 with `402` are exactly your hypothesis: Deepgram STT succeeded, but the downstream Gemini summarization call returned HTTP 402 (out of credits), so the row was marked failed. With credits restored, re-running will populate transcript + summary + survey_progress and the Progress column will start showing values.

## What this plan does

1. **Scope**: only the 245 bookings on 5/19 where
   - `record_type = 'research'`
   - `transcription_status = 'failed'`
   - `transcription_error_message = 'AI summary error: 402'`
   - `campaign_type = 'payment_experience'`

2. **Re-run** by invoking the existing `batch-retry-transcriptions` edge function with these specific booking IDs (it already supports a `bookingIds` array input and chunked processing).

3. **Process in chunks of ~25** with the function's built-in pacing so we don't hammer Deepgram / Gemini in one burst (~10 invocations total).

4. **Monitor**: after the run, re-query for 5/19 payment_experience records to confirm `transcription_status = completed` and that `booking_transcriptions.survey_progress` / `research_extraction` are populated. Report counts back.

5. **Out of scope** (will not touch):
   - The 219 "STT returned empty" rows — these are genuinely silent audio; retrying wastes credits.
   - The 2 transient connection errors — can be included optionally if you want; tell me and I'll add them.
   - Move-out / audience-survey campaigns on 5/19.
   - Any code, RLS, or function changes.

## Technical notes

- Edge function: `batch-retry-transcriptions` (already deployed, accepts `{ bookingIds: string[] }`).
- It calls the existing `transcribe-call` pipeline per booking, which re-stamps `booking_transcriptions` and triggers the downstream research processing (extraction + survey_progress) for research records.
- Estimated cost: ~$0.005–0.01 per record × 245 ≈ **$1.20–$2.50** total (Deepgram is already paid for completed STT in some cases; mostly Gemini re-run cost).
- Runtime estimate: ~5–10 minutes with chunked pacing.

## Why the Progress column will start populating

`Reports.tsx` reads `questionsAnswered / questionsTotal` from `booking_transcriptions.survey_progress`. That JSON is written by the post-transcription research pipeline. Today it's `null` because the pipeline died at the AI step. Once the retry completes successfully, `survey_progress` populates and the progress bar renders.
