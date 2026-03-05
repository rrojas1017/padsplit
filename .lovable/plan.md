

# Fix Research Record Contact Display & Auto-Enrich from Transcription

## Problem
1. Research records show "API Submission - {phoneNumber}" as the contact name in Reports — the phone number is embedded in `member_name` instead of being in `contact_phone`
2. When AI transcription extracts firstName, lastName, email, and phone from calls, these aren't written back to the `bookings` table for research records (or any records)

## Changes

### 1. Edge Function: `supabase/functions/transcribe-call/index.ts`
After the existing market data enrichment block (~line 1933), add a **contact details enrichment** block:
- If `memberDetails.firstName` or `memberDetails.lastName` is found and `member_name` starts with "API Submission", update `member_name` to the extracted name
- If `memberDetails.email` is found and `contact_email` is null, update `contact_email`
- If `memberDetails.phoneNumber` is found and `contact_phone` is null, update `contact_phone`

### 2. Edge Function: `supabase/functions/submit-conversation-audio/index.ts`
When creating the booking record, also populate `contact_phone` with the submitted phone number instead of only embedding it in `member_name`. The `member_name` should still be set as a fallback but `contact_phone` should be its own field.

### 3. Database Backfill (via insert tool)
- Extract phone numbers from existing "API Submission - {phone}" `member_name` values into `contact_phone` where it's null
- For records that already have transcription data with `memberDetails`, backfill `member_name`, `contact_email`, and `contact_phone` from the extracted data

### 4. Reports Display: `src/pages/Reports.tsx` (~line 971)
- For research records where `member_name` still starts with "API Submission", display `contact_phone` instead (or a cleaned version)
- Show the actual contact name if enrichment has populated it

### Files Changed
- `supabase/functions/transcribe-call/index.ts` — add contact enrichment after transcription
- `supabase/functions/submit-conversation-audio/index.ts` — populate `contact_phone` field
- `src/pages/Reports.tsx` — improve contact display for research records
- Database backfill — extract phones from member_name, enrich from existing transcription data

