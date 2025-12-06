-- Add performance indexes to speed up common queries
-- These indexes help with RLS policy evaluation and data fetching

-- Index on profiles(id) - primary lookup for auth
CREATE INDEX IF NOT EXISTS idx_profiles_id ON public.profiles(id);

-- Index on user_roles for auth lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- Index on bookings for common queries (if not exists)
CREATE INDEX IF NOT EXISTS idx_bookings_booking_date_desc ON public.bookings(booking_date DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_agent_id ON public.bookings(agent_id);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at_desc ON public.bookings(created_at DESC);

-- Index on agents for lookups
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON public.agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_site_id ON public.agents(site_id);

-- Index on access_logs for audit queries
CREATE INDEX IF NOT EXISTS idx_access_logs_user_id ON public.access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_created_at_desc ON public.access_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_action ON public.access_logs(action);