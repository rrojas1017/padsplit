-- Add stt_provider column to booking_transcriptions table
-- This tracks which STT provider was used for each transcription (elevenlabs or deepgram)
ALTER TABLE public.booking_transcriptions
ADD COLUMN stt_provider text DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.booking_transcriptions.stt_provider IS 'STT provider used: elevenlabs or deepgram';