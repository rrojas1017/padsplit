
-- Phase 1a: New columns on booking_transcriptions
ALTER TABLE public.booking_transcriptions
  ADD COLUMN IF NOT EXISTS research_extraction jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS research_classification jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS research_processed_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS research_processing_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS research_human_review boolean DEFAULT false;

-- Phase 1b: New columns on research_insights
ALTER TABLE public.research_insights
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'processing',
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS total_records_analyzed integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS analysis_period text,
  ADD COLUMN IF NOT EXISTS date_range_start date,
  ADD COLUMN IF NOT EXISTS date_range_end date,
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- Make campaign_id nullable (aggregate insights may span campaigns)
ALTER TABLE public.research_insights ALTER COLUMN campaign_id DROP NOT NULL;
ALTER TABLE public.research_insights ALTER COLUMN caller_type DROP NOT NULL;
ALTER TABLE public.research_insights ALTER COLUMN insight_type DROP NOT NULL;

-- Phase 1c: New research_prompts table
CREATE TABLE public.research_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_key text UNIQUE NOT NULL,
  prompt_text text NOT NULL,
  temperature numeric DEFAULT 0.2,
  model text DEFAULT 'google/gemini-2.5-pro',
  version integer DEFAULT 1,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.research_prompts ENABLE ROW LEVEL SECURITY;

-- RLS: admin/super_admin can manage
CREATE POLICY "Admins can manage research prompts"
ON public.research_prompts
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- RLS: supervisor can view
CREATE POLICY "Supervisors can view research prompts"
ON public.research_prompts
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'supervisor'::app_role));

-- Also allow admins to INSERT/UPDATE on research_insights (currently only super_admin ALL)
CREATE POLICY "Admins can insert research insights"
ON public.research_insights
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Allow service-level updates for background processing
CREATE POLICY "Admins can update research insights"
ON public.research_insights
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
