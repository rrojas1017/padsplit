-- Drop the overly permissive service role policy
DROP POLICY IF EXISTS "Service role can manage non_booking_insights" ON public.non_booking_insights;

-- Add update policy for admins (edge function uses service role key which bypasses RLS)
CREATE POLICY "Admins can update non_booking_insights"
  ON public.non_booking_insights
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );