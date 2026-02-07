-- Drop the existing constraint
ALTER TABLE member_insights 
DROP CONSTRAINT IF EXISTS member_insights_analysis_period_check;

-- Add updated constraint with new period values
ALTER TABLE member_insights 
ADD CONSTRAINT member_insights_analysis_period_check 
CHECK (analysis_period = ANY (ARRAY[
  'weekly', 'monthly', 'manual',
  'last7days', 'last30days',
  'thisWeek', 'lastMonth', 'thisMonth',
  'last3months', 'allTime'
]));