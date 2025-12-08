-- Add policy for admins to manage all goals (INSERT, UPDATE, DELETE)
CREATE POLICY "Admins can manage all goals"
ON public.agent_goals
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));