-- Add column to track when coaching audio was regenerated (one-time limit)
ALTER TABLE public.bookings 
ADD COLUMN coaching_audio_regenerated_at TIMESTAMP WITH TIME ZONE;