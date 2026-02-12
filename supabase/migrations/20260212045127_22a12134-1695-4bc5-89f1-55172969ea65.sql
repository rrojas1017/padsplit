
-- Create research_scripts table
CREATE TABLE public.research_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  campaign_type text NOT NULL CHECK (campaign_type IN ('satisfaction', 'market_research', 'retention')),
  target_audience text NOT NULL CHECK (target_audience IN ('existing_member', 'former_booking', 'rejected')),
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.research_scripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage research scripts"
  ON public.research_scripts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Researchers can view active scripts"
  ON public.research_scripts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'researcher') AND is_active = true);

CREATE TRIGGER update_research_scripts_updated_at
  BEFORE UPDATE ON public.research_scripts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create research_campaigns table
CREATE TABLE public.research_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  script_id uuid NOT NULL REFERENCES public.research_scripts(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'paused')),
  target_count int NOT NULL DEFAULT 0,
  start_date date,
  end_date date,
  assigned_researchers uuid[] NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.research_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage research campaigns"
  ON public.research_campaigns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Researchers can view assigned campaigns"
  ON public.research_campaigns FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'researcher') AND auth.uid() = ANY(assigned_researchers));

CREATE TRIGGER update_research_campaigns_updated_at
  BEFORE UPDATE ON public.research_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create research_calls table
CREATE TABLE public.research_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.research_campaigns(id) ON DELETE RESTRICT,
  researcher_id uuid NOT NULL REFERENCES public.profiles(id),
  caller_type text NOT NULL CHECK (caller_type IN ('existing_member', 'former_booking', 'rejected')),
  caller_name text NOT NULL,
  caller_phone text,
  caller_status text,
  original_booking_id uuid REFERENCES public.bookings(id),
  call_date date NOT NULL DEFAULT CURRENT_DATE,
  call_duration_seconds int,
  call_outcome text NOT NULL CHECK (call_outcome IN ('completed', 'no_answer', 'refused', 'callback_requested', 'transferred')),
  transferred_to_agent_id uuid REFERENCES public.agents(id),
  transfer_notes text,
  responses jsonb DEFAULT '{}'::jsonb,
  researcher_notes text,
  kixie_link text,
  transcription_status text CHECK (transcription_status IN ('pending', 'processing', 'completed', 'failed', 'unavailable')),
  call_transcription text,
  call_summary text,
  ai_analysis jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.research_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Researchers can insert their own calls"
  ON public.research_calls FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'researcher') AND researcher_id = auth.uid());

CREATE POLICY "Researchers can view their own calls"
  ON public.research_calls FOR SELECT TO authenticated
  USING (
    (public.has_role(auth.uid(), 'researcher') AND researcher_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can manage all research calls"
  ON public.research_calls FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_research_calls_campaign ON public.research_calls(campaign_id);
CREATE INDEX idx_research_calls_researcher ON public.research_calls(researcher_id);
CREATE INDEX idx_research_calls_date ON public.research_calls(call_date);

-- Create research_insights table
CREATE TABLE public.research_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.research_campaigns(id) ON DELETE CASCADE,
  caller_type text NOT NULL CHECK (caller_type IN ('existing_member', 'former_booking', 'rejected', 'all')),
  insight_type text NOT NULL CHECK (insight_type IN ('nps', 'sentiment', 'themes', 'competitors', 'features', 'recommendations', 'summary')),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.research_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view research insights"
  ON public.research_insights FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage research insights"
  ON public.research_insights FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX idx_research_insights_campaign ON public.research_insights(campaign_id);
