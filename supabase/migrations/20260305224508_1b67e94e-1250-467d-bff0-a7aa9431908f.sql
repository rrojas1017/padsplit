CREATE POLICY "Supervisors can view research insights"
ON public.research_insights
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'supervisor'::app_role));