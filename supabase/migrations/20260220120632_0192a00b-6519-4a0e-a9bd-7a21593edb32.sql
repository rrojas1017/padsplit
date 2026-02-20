
-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Service role has full access to failed_downstream_calls" ON public.failed_downstream_calls;

-- Admin/super_admin SELECT only
CREATE POLICY "Admins can view failed_downstream_calls"
ON public.failed_downstream_calls
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Service role inserts/updates via edge functions still work because service role bypasses RLS.
-- No INSERT/UPDATE/DELETE policies needed for regular users.
