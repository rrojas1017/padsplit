-- Create llm_provider_settings table for A/B testing between LLM providers
CREATE TABLE public.llm_provider_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  weight integer NOT NULL DEFAULT 0 CHECK (weight >= 0 AND weight <= 100),
  api_config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create llm_quality_comparisons table for storing A/B test results
CREATE TABLE public.llm_quality_comparisons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  transcription_text text NOT NULL,
  call_duration_seconds integer,
  
  -- Lovable AI (Gemini) results
  gemini_analysis jsonb,
  gemini_model text,
  gemini_input_tokens integer,
  gemini_output_tokens integer,
  gemini_latency_ms integer,
  gemini_estimated_cost numeric(10, 6),
  
  -- DeepSeek results
  deepseek_analysis jsonb,
  deepseek_model text,
  deepseek_input_tokens integer,
  deepseek_output_tokens integer,
  deepseek_latency_ms integer,
  deepseek_estimated_cost numeric(10, 6),
  
  comparison_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.llm_provider_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llm_quality_comparisons ENABLE ROW LEVEL SECURITY;

-- RLS policies for llm_provider_settings (super_admin and admin only)
CREATE POLICY "Super admins and admins can view LLM provider settings"
ON public.llm_provider_settings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'admin')
  )
);

CREATE POLICY "Super admins can manage LLM provider settings"
ON public.llm_provider_settings
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
);

-- RLS policies for llm_quality_comparisons (super_admin and admin only)
CREATE POLICY "Super admins and admins can view LLM comparisons"
ON public.llm_quality_comparisons
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'admin')
  )
);

CREATE POLICY "Super admins can manage LLM comparisons"
ON public.llm_quality_comparisons
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
);

-- Create updated_at trigger for llm_provider_settings
CREATE TRIGGER update_llm_provider_settings_updated_at
BEFORE UPDATE ON public.llm_provider_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed data for providers
INSERT INTO public.llm_provider_settings (provider_name, is_active, weight, api_config)
VALUES 
  ('lovable_ai', true, 100, '{"model": "google/gemini-2.5-flash", "model_pro": "google/gemini-2.5-pro"}'::jsonb),
  ('deepseek', true, 0, '{"model": "deepseek-chat"}'::jsonb);

-- Create index for faster lookups
CREATE INDEX idx_llm_quality_comparisons_booking_id ON public.llm_quality_comparisons(booking_id);
CREATE INDEX idx_llm_quality_comparisons_created_at ON public.llm_quality_comparisons(created_at DESC);