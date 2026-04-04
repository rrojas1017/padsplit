
-- Create script_responses table
CREATE TABLE public.script_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID NOT NULL REFERENCES public.research_scripts(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  question_order INTEGER NOT NULL,
  response_value TEXT,
  response_options TEXT[],
  response_numeric NUMERIC,
  respondent_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_script_responses_script ON public.script_responses(script_id);
CREATE INDEX idx_script_responses_session ON public.script_responses(session_id);

ALTER TABLE public.script_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage script_responses" ON public.script_responses
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read script_responses" ON public.script_responses
  FOR SELECT TO authenticated USING (true);

-- Add tracking columns to research_scripts
ALTER TABLE public.research_scripts
  ADD COLUMN IF NOT EXISTS total_responses INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_response_at TIMESTAMPTZ;
