-- Add conversation validation column to track bookings without real conversations
ALTER TABLE public.bookings 
ADD COLUMN has_valid_conversation boolean DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.bookings.has_valid_conversation IS 'Indicates if the booking had a real two-way conversation. NULL = not yet analyzed, true = valid conversation, false = voicemail/failed connection';

-- Add partial index for efficient filtering of flagged records
CREATE INDEX idx_bookings_valid_conversation 
ON public.bookings(has_valid_conversation) 
WHERE has_valid_conversation = false;

-- Backfill existing records based on call duration and transcription status
-- Flag short calls (< 30s) that have completed transcription as likely voicemails
UPDATE public.bookings
SET has_valid_conversation = false
WHERE transcription_status = 'completed'
  AND call_duration_seconds IS NOT NULL
  AND call_duration_seconds < 30;