-- Add missing indexes for RLS optimization
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_site_id ON public.profiles(site_id);

-- Create optimized function for booking visibility check
CREATE OR REPLACE FUNCTION public.can_view_booking(booking_agent_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    CASE 
      -- Super admin or admin can view all
      WHEN EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('super_admin', 'admin')
      ) THEN true
      -- Supervisor can view their site's bookings
      WHEN EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN profiles p ON ur.user_id = p.id
        JOIN agents a ON a.site_id = p.site_id
        WHERE ur.user_id = auth.uid() 
        AND ur.role = 'supervisor'
        AND a.id = booking_agent_id
      ) THEN true
      -- Agent can view their own bookings
      WHEN EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN agents a ON a.user_id = ur.user_id
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'agent'
        AND a.id = booking_agent_id
      ) THEN true
      ELSE false
    END
$$;

-- Drop and recreate the bookings SELECT policy with optimized function
DROP POLICY IF EXISTS "Users can view bookings based on role" ON public.bookings;
CREATE POLICY "Users can view bookings based on role" ON public.bookings
  FOR SELECT USING (can_view_booking(agent_id));