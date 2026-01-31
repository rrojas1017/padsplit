-- Add A/B testing tracking columns to booking_transcriptions
ALTER TABLE booking_transcriptions 
ADD COLUMN IF NOT EXISTS stt_latency_ms INTEGER,
ADD COLUMN IF NOT EXISTS stt_word_count INTEGER,
ADD COLUMN IF NOT EXISTS stt_confidence_score NUMERIC(4,3);

-- Add provider selection settings table
CREATE TABLE IF NOT EXISTS stt_provider_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  weight INTEGER DEFAULT 50 CHECK (weight >= 0 AND weight <= 100),
  api_config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on stt_provider_settings
ALTER TABLE stt_provider_settings ENABLE ROW LEVEL SECURITY;

-- Super admins can read provider settings
CREATE POLICY "Super admins can read stt provider settings"
ON stt_provider_settings FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  )
);

-- Super admins can manage provider settings
CREATE POLICY "Super admins can manage stt provider settings"
ON stt_provider_settings FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  )
);

-- Seed initial providers with 50/50 split
INSERT INTO stt_provider_settings (provider_name, weight, is_active) VALUES
  ('elevenlabs', 50, true),
  ('deepgram', 50, true)
ON CONFLICT (provider_name) DO NOTHING;

-- Add trigger for updated_at
CREATE TRIGGER update_stt_provider_settings_updated_at
BEFORE UPDATE ON stt_provider_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();