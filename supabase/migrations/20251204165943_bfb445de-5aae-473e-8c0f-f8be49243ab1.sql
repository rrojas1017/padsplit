-- Drop the incorrect policy (missing TO authenticated)
DROP POLICY IF EXISTS "Supervisors can view agents in their site" ON public.profiles;

-- Re-create with correct role assignment
CREATE POLICY "Supervisors can view agents in their site"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'supervisor'::app_role) 
  AND site_id = get_user_site_id(auth.uid())
  AND id IN (
    SELECT user_id FROM user_roles WHERE role = 'agent'::app_role
  )
);

-- Allow supervisors to view agent roles in their site
CREATE POLICY "Supervisors can view agent roles in their site"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'supervisor'::app_role) 
  AND role = 'agent'::app_role
  AND user_id IN (
    SELECT id FROM profiles 
    WHERE site_id = get_user_site_id(auth.uid())
  )
);