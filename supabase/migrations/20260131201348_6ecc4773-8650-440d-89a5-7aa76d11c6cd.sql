-- Add enable_ai_polish column to stt_provider_settings table
-- This allows toggling AI polishing for Deepgram transcripts
ALTER TABLE public.stt_provider_settings 
ADD COLUMN IF NOT EXISTS enable_ai_polish BOOLEAN DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.stt_provider_settings.enable_ai_polish IS 'When true, Deepgram transcripts will be polished using AI to improve formatting (capitalization, punctuation, number formatting)';