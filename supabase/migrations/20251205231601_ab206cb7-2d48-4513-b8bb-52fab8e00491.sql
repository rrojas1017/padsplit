-- Add indexes for bookings table
CREATE INDEX IF NOT EXISTS idx_bookings_agent_id ON public.bookings(agent_id);
CREATE INDEX IF NOT EXISTS idx_bookings_booking_date ON public.bookings(booking_date DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON public.bookings(created_at DESC);

-- Add indexes for agents table
CREATE INDEX IF NOT EXISTS idx_agents_site_id ON public.agents(site_id);
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON public.agents(user_id);

-- Add indexes for access_logs table
CREATE INDEX IF NOT EXISTS idx_access_logs_user_id ON public.access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_created_at ON public.access_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_action ON public.access_logs(action);

-- Update access_logs check constraint to include all page tracking actions
ALTER TABLE public.access_logs DROP CONSTRAINT IF EXISTS access_logs_action_check;
ALTER TABLE public.access_logs ADD CONSTRAINT access_logs_action_check 
  CHECK (action IN (
    'login', 'logout', 'view_dashboard', 'export_csv', 'role_change', 'data_import',
    'view_reports', 'view_member_insights', 'view_coaching_hub', 'view_leaderboard',
    'view_my_performance', 'view_wallboard', 'view_add_booking', 'view_agent_status',
    'view_user_management', 'view_display_links', 'view_import_bookings', 
    'view_audit_log', 'view_settings', 'view_edit_booking'
  ));