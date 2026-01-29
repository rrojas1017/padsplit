-- Add status column to member_insights table for background processing tracking
ALTER TABLE member_insights 
ADD COLUMN status text DEFAULT 'completed';

-- Add check constraint
ALTER TABLE member_insights
ADD CONSTRAINT member_insights_status_check 
CHECK (status IN ('processing', 'completed', 'failed'));

-- Add error_message column for failed analyses
ALTER TABLE member_insights 
ADD COLUMN error_message text;