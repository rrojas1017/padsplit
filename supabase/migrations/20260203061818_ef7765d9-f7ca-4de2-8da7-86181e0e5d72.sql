-- Drop the old constraint
ALTER TABLE public.member_insights DROP CONSTRAINT member_insights_analysis_period_check;

-- Add new constraint with all period options
ALTER TABLE public.member_insights ADD CONSTRAINT member_insights_analysis_period_check 
CHECK (analysis_period = ANY (ARRAY['weekly', 'monthly', 'manual', 'last7days', 'last30days', 'thisMonth', 'last3months', 'allTime']::text[]));