# Backfill missing Progress for 5/19 Payment Experience calls

## What's wrong

For `booking_date = 2026-05-19`, `campaign = payment_experience`, **512 records have a transcript but `booking_transcriptions.survey_progress = NULL`** — so the Progress column in `/reports` renders `—`. Breakdown:

- 51 long transcripts (avg ~2,873 chars) — real conversations, should yield meaningful 5–16/16 progress
- 124 medium (200–500 chars) — partial conversations, likely 1–5/16
- 337 short (<200 chars) — voicemails/early hang-ups, will resolve to 0/16 or 1/16 but at least stop showing `—`
- 21 already have progress (won't be touched)

The 219 STT-empty + 2 transient transcription failures are **out of scope** — they have no transcript to analyze.

## What to do (no schema or code changes)

1. **One-time scoped invocation** of the existing edge function `backfill-payment-experience-progress` with a new `bookingIds` filter for the 5/19 PE cohort (512 IDs). The function already:
   - Loads the PE script (16 questions) once
   - Uses Gemini Flash to map transcript → `{ answered, total: 16, questions_covered: [] }`
   - Updates **only** `booking_transcriptions.survey_progress` — nothing else
   - Chunks 25 with self-retrigger
   - Has dry-run mode

2. **Minimal code edit (1 file):** `supabase/functions/backfill-payment-experience-progress/index.ts`
   - Accept optional `bookingIds: string[]` in request body. When present, skip the campaign→calls→bookings resolver and use that list directly. All existing logic (candidate filter, AI call, update, self-chain) stays identical.
   - This avoids the global PE backfill picking up unrelated rows first (it orders by `updated_at NULLS FIRST`, so 5/19 rows would be processed last).

3. **Run it:**
   - Build the 512-ID list (one query).
   - Invoke with `{ bookingIds: [...], dryRun: true }` → confirm 512 candidates.
   - Invoke with `{ bookingIds: [...] }` → it self-chains in chunks of 25 (~20 invocations, ~5–8 min total).

4. **Verify:** Re-query 5/19 PE rows; expect `survey_progress` populated on all 512. Refresh `/reports` → Progress column shows values.

## Out of scope

- The 221 records with no transcript (silent audio / transient STT errors) — would need transcription retry, not progress backfill
- Other campaigns or other dates
- Any RLS, storage, signed URL, or auth changes
- `research_extraction` / `research_classification` columns — only `survey_progress` is touched
- Frontend changes — `Reports.tsx` already renders Progress correctly when `survey_progress` exists

## Cost / time

- ~512 Gemini Flash calls × ~$0.0003 ≈ **$0.15–$0.20 total**
- Runtime ~5–8 minutes with built-in pacing

## Technical notes

The customer contact you offered isn't needed — the cohort is deterministically resolvable from `bookings.research_call_id → research_calls.campaign_id → research_campaigns.script_id = c701a243-1c66-425a-8f79-99a290ec5b6b` on `booking_date = 2026-05-19`. Keep the contact handy in case any specific record needs spot-checking after the run.
