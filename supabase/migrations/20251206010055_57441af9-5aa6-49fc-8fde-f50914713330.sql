-- Add transcription_error_message column to bookings table
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS transcription_error_message text;

-- Create index for filtering by transcription status
CREATE INDEX IF NOT EXISTS idx_bookings_transcription_status ON public.bookings(transcription_status);