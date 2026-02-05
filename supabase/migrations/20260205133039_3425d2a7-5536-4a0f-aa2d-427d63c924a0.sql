-- Add llm_provider column to track which LLM was used for analysis
ALTER TABLE booking_transcriptions 
ADD COLUMN IF NOT EXISTS llm_provider text DEFAULT 'lovable_ai';

COMMENT ON COLUMN booking_transcriptions.llm_provider IS 
  'LLM provider used for analysis: lovable_ai (Gemini), deepseek';

-- Update deepseek provider api_config with fallback settings
UPDATE llm_provider_settings 
SET api_config = jsonb_build_object(
  'model', 'deepseek-chat',
  'use_gemini_fallback_for', ARRAY['non_booking', 'negative_sentiment'],
  'enable_two_pass_sentiment', true
)
WHERE provider_name = 'deepseek';