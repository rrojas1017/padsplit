-- Phase 1: Optimize the can_view_booking RLS function
-- This function was running 3 separate EXISTS queries with JOINs per row
CREATE OR REPLACE FUNCTION public.can_view_booking(booking_agent_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    -- Super admin or admin can view all (fast check)
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
    OR
    -- Agent viewing their own booking
    EXISTS (
      SELECT 1 FROM agents 
      WHERE user_id = auth.uid() 
      AND id = booking_agent_id
    )
    OR
    -- Supervisor viewing their site's bookings
    EXISTS (
      SELECT 1 FROM agents a
      WHERE a.id = booking_agent_id
      AND a.site_id = (
        SELECT p.site_id FROM profiles p
        JOIN user_roles ur ON ur.user_id = p.id
        WHERE ur.user_id = auth.uid() AND ur.role = 'supervisor'
        LIMIT 1
      )
    )
$$;

-- Phase 2: Add composite indexes for RLS function optimization
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role 
ON user_roles(user_id, role);

CREATE INDEX IF NOT EXISTS idx_agents_user_site 
ON agents(user_id, id, site_id);

CREATE INDEX IF NOT EXISTS idx_profiles_id_site 
ON profiles(id, site_id);

-- Phase 5: Clean up old inactive sessions (older than 7 days)
DELETE FROM agent_sessions 
WHERE is_active = false 
AND logout_time < NOW() - INTERVAL '7 days';