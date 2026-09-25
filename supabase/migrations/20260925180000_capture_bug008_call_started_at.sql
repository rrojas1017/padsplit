-- Capture of drift #43 (BUG-008), applied directly on 2026-09-25.
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS call_started_at timestamptz;
COMMENT ON COLUMN public.bookings.call_started_at IS 'When the call started (dialer recording filename in UTC-4, callTimestamp from the API, or startedAt from the public survey page). NULL = unknown.';
