-- Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Supervisors can view agents in their site" ON public.profiles;
DROP POLICY IF EXISTS "Supervisors can view agent roles in their site" ON public.user_roles;

-- Create helper function to check if a user is an agent (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_agent(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'agent'::app_role
  )
$$;

-- Create helper function to get all agent user_ids for a given site (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_agent_user_ids_for_site(_site_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id 
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p.site_id = _site_id AND ur.role = 'agent'::app_role
$$;

-- Recreate policy: Supervisors can view agent profiles in their site
CREATE POLICY "Supervisors can view agents in their site"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'supervisor'::app_role) 
  AND site_id = get_user_site_id(auth.uid())
  AND is_agent(id)
);

-- Recreate policy: Supervisors can view agent roles in their site
CREATE POLICY "Supervisors can view agent roles in their site"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'supervisor'::app_role) 
  AND role = 'agent'::app_role
  AND user_id IN (SELECT * FROM get_agent_user_ids_for_site(get_user_site_id(auth.uid())))
);