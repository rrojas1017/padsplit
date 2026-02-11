-- Drop the duplicate INSERT trigger (keep trigger_auto_transcription_insert)
DROP TRIGGER IF EXISTS trigger_auto_transcription ON public.bookings;