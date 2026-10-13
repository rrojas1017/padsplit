-- Capture of drift #54 (BUG-009), applied directly on 2026-10-13.
CREATE POLICY "Supervisors can view active scripts" ON public.research_scripts FOR SELECT TO authenticated USING (has_role(auth.uid(), 'supervisor'::app_role) AND is_active = true);
