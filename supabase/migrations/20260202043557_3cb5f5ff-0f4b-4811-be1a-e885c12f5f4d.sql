-- Drop existing policy that uses get_my_role() which fails in embedded queries
DROP POLICY IF EXISTS "view_transcription" ON public.booking_transcriptions;

-- Recreate with has_role() for reliability in embedded relation queries
CREATE POLICY "view_transcription" ON public.booking_transcriptions
FOR SELECT USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role) OR
  (has_role(auth.uid(), 'supervisor'::app_role) AND booking_id IN (
    SELECT b.id FROM bookings b 
    JOIN agents a ON b.agent_id = a.id 
    WHERE a.site_id = get_user_site_id(auth.uid())
  )) OR
  (has_role(auth.uid(), 'agent'::app_role) AND booking_id IN (
    SELECT b.id FROM bookings b 
    JOIN agents a ON b.agent_id = a.id 
    WHERE a.user_id = auth.uid()
  ))
);