-- Add QA coaching audio columns to booking_transcriptions
ALTER TABLE public.booking_transcriptions
ADD COLUMN IF NOT EXISTS qa_coaching_audio_url TEXT,
ADD COLUMN IF NOT EXISTS qa_coaching_audio_generated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS qa_coaching_audio_listened_at TIMESTAMPTZ;

-- Create qa_coaching_settings table for Katty QA configuration
CREATE TABLE IF NOT EXISTS public.qa_coaching_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voice_id TEXT NOT NULL DEFAULT 'EXAVITQu4vr4xnSDxMaL',  -- Sarah (empathetic female)
  coaching_tone TEXT NOT NULL DEFAULT 'empathetic',
  max_audio_length_seconds INTEGER NOT NULL DEFAULT 60,
  always_emphasize TEXT[] DEFAULT '{}',
  never_mention TEXT[] DEFAULT '{}',
  custom_expressions TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on qa_coaching_settings
ALTER TABLE public.qa_coaching_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for admins to manage qa_coaching_settings
CREATE POLICY "Admins can manage qa_coaching_settings"
ON public.qa_coaching_settings
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_qa_coaching_settings_updated_at
BEFORE UPDATE ON public.qa_coaching_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings if none exist
INSERT INTO public.qa_coaching_settings (voice_id, coaching_tone, max_audio_length_seconds, is_active)
SELECT 'EXAVITQu4vr4xnSDxMaL', 'empathetic', 60, true
WHERE NOT EXISTS (SELECT 1 FROM public.qa_coaching_settings WHERE is_active = true);