-- Add call transcription fields to bookings table (all nullable for safety)
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS call_transcription TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS call_summary TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS call_key_points JSONB;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS transcription_status TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS transcribed_at TIMESTAMPTZ;