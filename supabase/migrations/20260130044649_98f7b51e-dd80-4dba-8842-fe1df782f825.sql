-- Add new columns to member_insights table for enhanced tracking
ALTER TABLE public.member_insights 
  ADD COLUMN IF NOT EXISTS previous_insight_id UUID REFERENCES public.member_insights(id),
  ADD COLUMN IF NOT EXISTS source_booking_ids JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS emerging_issues JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS trend_comparison JSONB DEFAULT NULL;

-- Add index for faster lookup of previous insights
CREATE INDEX IF NOT EXISTS idx_member_insights_analysis_period ON public.member_insights(analysis_period, date_range_end DESC);