-- Add policy allowing agents to update coaching_audio_listened_at on their own bookings
CREATE POLICY "agent_mark_audio_listened"
ON public.booking_transcriptions
FOR UPDATE
USING (
  get_my_role() = 'agent'
  AND booking_id IN (
    SELECT b.id FROM bookings b
    JOIN agents a ON b.agent_id = a.id
    WHERE a.user_id = auth.uid()
  )
)
WITH CHECK (
  get_my_role() = 'agent'
  AND booking_id IN (
    SELECT b.id FROM bookings b
    JOIN agents a ON b.agent_id = a.id
    WHERE a.user_id = auth.uid()
  )
);