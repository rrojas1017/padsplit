-- Add column to track when coaching audio was listened to
ALTER TABLE public.booking_transcriptions 
ADD COLUMN IF NOT EXISTS coaching_audio_listened_at TIMESTAMPTZ DEFAULT NULL;