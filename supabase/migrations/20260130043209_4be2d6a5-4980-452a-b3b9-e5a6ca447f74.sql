-- Add avg_call_duration_seconds column to member_insights table
ALTER TABLE member_insights 
ADD COLUMN avg_call_duration_seconds NUMERIC DEFAULT 0;