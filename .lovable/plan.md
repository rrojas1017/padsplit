

## Fix: Prevent "N/A" and other junk values from triggering transcription

**Problem**: Some imported records have `kixie_link = 'N/A'` (or similar placeholder strings). The auto-transcription trigger fires because the field is not null, then fails at URL validation.

**Two-part fix**:

### 1. Clean existing bad data (migration)
Update all bookings where `kixie_link` is a known junk value ('N/A', 'n/a', 'NA', 'none', '-', '') to set it to NULL and reset `transcription_status` from 'failed' to NULL so these records stop showing as failed.

### 2. Guard the transcription trigger
In `check-auto-transcription` edge function (and/or the database triggers), add a URL format check before attempting transcription. Skip records where `kixie_link` doesn't start with `http`.

### Files to update
- **New migration**: Clean junk `kixie_link` values
- `supabase/functions/check-auto-transcription/index.ts`: Add URL validation guard
- Optionally `supabase/functions/transcribe-call/index.ts`: Early return for non-URL values

