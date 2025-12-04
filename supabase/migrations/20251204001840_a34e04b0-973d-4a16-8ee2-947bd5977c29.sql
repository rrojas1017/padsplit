-- Fix profiles table: Update SELECT policies to explicitly require authentication
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL AND id = auth.uid());

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Fix agents table: Replace weak "true" condition with proper auth check
DROP POLICY IF EXISTS "Authenticated users can view agents" ON public.agents;

CREATE POLICY "Authenticated users can view agents"
ON public.agents
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Fix bookings table: Add explicit auth check to existing policies
DROP POLICY IF EXISTS "Users can view bookings based on role" ON public.bookings;

CREATE POLICY "Users can view bookings based on role"
ON public.bookings
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role) OR 
    (has_role(auth.uid(), 'supervisor'::app_role) AND agent_id IN (
      SELECT id FROM agents WHERE site_id = get_user_site_id(auth.uid())
    )) OR 
    (has_role(auth.uid(), 'agent'::app_role) AND agent_id IN (
      SELECT id FROM agents WHERE user_id = auth.uid()
    ))
  )
);