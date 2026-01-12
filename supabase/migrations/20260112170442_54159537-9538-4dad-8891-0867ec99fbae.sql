-- Create calls table to store all Kixie calls (booking or not)
CREATE TABLE public.calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kixie_call_id TEXT UNIQUE,
  recording_url TEXT,
  call_type TEXT NOT NULL DEFAULT 'outgoing',
  call_status TEXT NOT NULL DEFAULT 'answered',
  call_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_seconds INTEGER,
  from_number TEXT,
  to_number TEXT,
  kixie_agent_name TEXT,
  kixie_agent_email TEXT,
  agent_id UUID REFERENCES public.agents(id),
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  hubspot_link TEXT,
  disposition TEXT,
  outcome_category TEXT,
  booking_id UUID REFERENCES public.bookings(id),
  transcription_status TEXT DEFAULT 'pending',
  transcription_error_message TEXT,
  transcribed_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'manual',
  raw_webhook_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create call_transcriptions table for call-specific transcriptions
CREATE TABLE public.call_transcriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL UNIQUE REFERENCES public.calls(id) ON DELETE CASCADE,
  call_transcription TEXT,
  call_summary TEXT,
  call_key_points JSONB,
  agent_feedback JSONB,
  qa_scores JSONB,
  coaching_audio_url TEXT,
  coaching_audio_generated_at TIMESTAMPTZ,
  coaching_audio_listened_at TIMESTAMPTZ,
  qa_coaching_audio_url TEXT,
  qa_coaching_audio_generated_at TIMESTAMPTZ,
  qa_coaching_audio_listened_at TIMESTAMPTZ,
  stt_provider TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create webhook_settings table for configuration
CREATE TABLE public.webhook_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL UNIQUE,
  webhook_secret TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  auto_transcribe BOOLEAN NOT NULL DEFAULT true,
  min_duration_seconds INTEGER DEFAULT 30,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default Kixie webhook settings
INSERT INTO public.webhook_settings (provider, is_active, auto_transcribe, min_duration_seconds)
VALUES ('kixie', false, true, 30);

-- Enable RLS on all tables
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for calls table
CREATE POLICY "Admins can manage all calls"
ON public.calls FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Supervisors can view calls in their site"
ON public.calls FOR SELECT
USING (
  has_role(auth.uid(), 'supervisor'::app_role) 
  AND agent_id IN (
    SELECT id FROM public.agents WHERE site_id = get_user_site_id(auth.uid())
  )
);

CREATE POLICY "Agents can view their own calls"
ON public.calls FOR SELECT
USING (
  has_role(auth.uid(), 'agent'::app_role)
  AND agent_id IN (
    SELECT id FROM public.agents WHERE user_id = auth.uid()
  )
);

-- RLS policies for call_transcriptions table
CREATE POLICY "Admins can manage all call_transcriptions"
ON public.call_transcriptions FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Supervisors can view call_transcriptions in their site"
ON public.call_transcriptions FOR SELECT
USING (
  has_role(auth.uid(), 'supervisor'::app_role)
  AND call_id IN (
    SELECT c.id FROM public.calls c
    JOIN public.agents a ON c.agent_id = a.id
    WHERE a.site_id = get_user_site_id(auth.uid())
  )
);

CREATE POLICY "Agents can view their own call_transcriptions"
ON public.call_transcriptions FOR SELECT
USING (
  has_role(auth.uid(), 'agent'::app_role)
  AND call_id IN (
    SELECT c.id FROM public.calls c
    JOIN public.agents a ON c.agent_id = a.id
    WHERE a.user_id = auth.uid()
  )
);

CREATE POLICY "Agents can update their own call_transcriptions"
ON public.call_transcriptions FOR UPDATE
USING (
  has_role(auth.uid(), 'agent'::app_role)
  AND call_id IN (
    SELECT c.id FROM public.calls c
    JOIN public.agents a ON c.agent_id = a.id
    WHERE a.user_id = auth.uid()
  )
);

-- RLS policies for webhook_settings table
CREATE POLICY "Admins can manage webhook_settings"
ON public.webhook_settings FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Create updated_at triggers
CREATE TRIGGER update_calls_updated_at
BEFORE UPDATE ON public.calls
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_call_transcriptions_updated_at
BEFORE UPDATE ON public.call_transcriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_webhook_settings_updated_at
BEFORE UPDATE ON public.webhook_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_calls_agent_id ON public.calls(agent_id);
CREATE INDEX idx_calls_booking_id ON public.calls(booking_id);
CREATE INDEX idx_calls_call_date ON public.calls(call_date DESC);
CREATE INDEX idx_calls_kixie_call_id ON public.calls(kixie_call_id);
CREATE INDEX idx_calls_transcription_status ON public.calls(transcription_status);
CREATE INDEX idx_call_transcriptions_call_id ON public.call_transcriptions(call_id);