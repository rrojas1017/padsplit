-- Add agent_feedback JSONB column to bookings table
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS agent_feedback jsonb;