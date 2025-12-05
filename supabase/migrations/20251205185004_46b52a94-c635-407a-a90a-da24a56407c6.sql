-- Create member_insights table for storing periodic analysis results
CREATE TABLE public.member_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_period TEXT NOT NULL CHECK (analysis_period IN ('weekly', 'monthly', 'manual')),
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  total_calls_analyzed INTEGER NOT NULL DEFAULT 0,
  pain_points JSONB DEFAULT '[]'::jsonb,
  payment_insights JSONB DEFAULT '[]'::jsonb,
  transportation_insights JSONB DEFAULT '[]'::jsonb,
  price_sensitivity JSONB DEFAULT '[]'::jsonb,
  move_in_barriers JSONB DEFAULT '[]'::jsonb,
  property_preferences JSONB DEFAULT '[]'::jsonb,
  objection_patterns JSONB DEFAULT '[]'::jsonb,
  market_breakdown JSONB DEFAULT '{}'::jsonb,
  sentiment_distribution JSONB DEFAULT '{"positive": 0, "neutral": 0, "negative": 0}'::jsonb,
  ai_recommendations JSONB DEFAULT '[]'::jsonb,
  member_journey_insights JSONB DEFAULT '[]'::jsonb,
  raw_analysis TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.member_insights ENABLE ROW LEVEL SECURITY;

-- Only admins and super_admins can view member insights
CREATE POLICY "Admins can view member insights"
ON public.member_insights
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Only admins and super_admins can create member insights
CREATE POLICY "Admins can create member insights"
ON public.member_insights
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Only super_admins can delete member insights
CREATE POLICY "Super admins can delete member insights"
ON public.member_insights
FOR DELETE
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Create index for faster queries
CREATE INDEX idx_member_insights_period ON public.member_insights(analysis_period, date_range_end DESC);
CREATE INDEX idx_member_insights_created ON public.member_insights(created_at DESC);