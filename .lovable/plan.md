# Plan: CR-005 capture migration file (drift #45/#46)

## Goal
Capture database changes that were already applied directly to production earlier today as a migration file for the repo record only. The file must be written but never executed.

## Action
Create exactly one new file:

`supabase/migrations/20260925190000_capture_cr005_dialer_linking.sql`

with the byte-for-byte content the user provided between the markers (33 lines, ending with a single trailing newline after the last semicolon, no other changes). The content includes:

- `ALTER TABLE public.research_calls` adding nullable columns `dialer_call_id`, `dialer_lead_id`, `dialer_agent_user`.
- A CHECK constraint `research_calls_dialer_fields_len_check` capping each at 64 chars.
- Partial UNIQUE index `research_calls_campaign_dialer_call_key` on `(campaign_id, dialer_call_id)` where `dialer_call_id IS NOT NULL`.
- Partial index `idx_research_calls_public_fallback` on `(campaign_id, dialer_agent_user, created_at)` where `caller_type = 'public'`.
- Three `COMMENT ON COLUMN` statements.
- Partial UNIQUE index `bookings_research_call_id_key` on `public.bookings(research_call_id)` where `research_call_id IS NOT NULL` (closes form/recording double-insert race).

## What will NOT happen
- No migration tool used; no SQL executed; no database touched.
- No `types.ts` regeneration.
- No other file created, edited, or deleted.
- Nothing published.

## Verification
After writing, report `md5sum` and `wc -l` of the file. Expected:
- md5 `b79b0a70b3c0ef60d15de83fc30ff7af`
- 33 lines
