-- Create non_booking_insights table to store aggregated Non-Booking analysis
CREATE TABLE public.non_booking_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_period TEXT NOT NULL,
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  total_calls_analyzed INTEGER NOT NULL DEFAULT 0,
  rejection_reasons JSONB,
  missed_opportunities JSONB,
  sentiment_distribution JSONB,
  objection_patterns JSONB,
  recovery_recommendations JSONB,
  agent_breakdown JSONB,
  market_breakdown JSONB,
  trend_comparison JSONB,
  avg_call_duration_seconds NUMERIC,
  raw_analysis TEXT,
  status TEXT DEFAULT 'processing',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.non_booking_insights ENABLE ROW LEVEL SECURITY;

-- Policies: Super admins and admins can view/create
CREATE POLICY "Admins can view non_booking_insights"
  ON public.non_booking_insights
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can insert non_booking_insights"
  ON public.non_booking_insights
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Service role can manage non_booking_insights"
  ON public.non_booking_insights
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_non_booking_insights_status ON public.non_booking_insights(status);
CREATE INDEX idx_non_booking_insights_created_at ON public.non_booking_insights(created_at DESC);