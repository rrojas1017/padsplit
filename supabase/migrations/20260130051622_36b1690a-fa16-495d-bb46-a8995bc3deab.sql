-- Add customer_journeys column to member_insights table
ALTER TABLE public.member_insights ADD COLUMN IF NOT EXISTS customer_journeys JSONB DEFAULT '[]';