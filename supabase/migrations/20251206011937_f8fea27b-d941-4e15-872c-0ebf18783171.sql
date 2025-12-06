-- Add index on agent_id for faster lookups and RLS checks
CREATE INDEX IF NOT EXISTS idx_bookings_agent_id ON public.bookings(agent_id);