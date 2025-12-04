-- Allow supervisors to view agent profiles in their site
CREATE POLICY "Supervisors can view agents in their site"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'supervisor'::app_role) 
  AND site_id = get_user_site_id(auth.uid())
  AND id IN (
    SELECT user_id FROM user_roles WHERE role = 'agent'
  )
);