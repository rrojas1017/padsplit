-- Create voice coaching settings table
CREATE TABLE public.voice_coaching_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coaching_tone TEXT NOT NULL DEFAULT 'energetic',
  custom_expressions TEXT[] DEFAULT '{}',
  always_emphasize TEXT[] DEFAULT '{}',
  never_mention TEXT[] DEFAULT '{}',
  voice_id TEXT NOT NULL DEFAULT 'nPczCjzI2devNBz1zQrb',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.voice_coaching_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage voice coaching settings
CREATE POLICY "Admins can manage voice_coaching_settings"
ON public.voice_coaching_settings
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_voice_coaching_settings_updated_at
BEFORE UPDATE ON public.voice_coaching_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();