-- Create transcription_auto_rules table
CREATE TABLE public.transcription_auto_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('global', 'call_type', 'agent', 'site')),
  call_type_id UUID REFERENCES public.call_types(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
  site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE,
  auto_transcribe BOOLEAN NOT NULL DEFAULT true,
  auto_coaching BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add constraint to ensure proper rule_type/reference combinations
ALTER TABLE public.transcription_auto_rules 
ADD CONSTRAINT valid_rule_reference CHECK (
  (rule_type = 'global' AND call_type_id IS NULL AND agent_id IS NULL AND site_id IS NULL) OR
  (rule_type = 'call_type' AND call_type_id IS NOT NULL AND agent_id IS NULL AND site_id IS NULL) OR
  (rule_type = 'agent' AND agent_id IS NOT NULL AND call_type_id IS NULL AND site_id IS NULL) OR
  (rule_type = 'site' AND site_id IS NOT NULL AND call_type_id IS NULL AND agent_id IS NULL)
);

-- Enable RLS
ALTER TABLE public.transcription_auto_rules ENABLE ROW LEVEL SECURITY;

-- RLS policies - only admins can manage
CREATE POLICY "Admins can manage transcription_auto_rules"
ON public.transcription_auto_rules
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_transcription_auto_rules_updated_at
BEFORE UPDATE ON public.transcription_auto_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();