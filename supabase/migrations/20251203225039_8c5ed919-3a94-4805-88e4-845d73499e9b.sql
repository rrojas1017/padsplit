-- Update INSERT policy to allow agents to create bookings
DROP POLICY IF EXISTS "Admins and supervisors can create bookings" ON bookings;
CREATE POLICY "Authenticated users can create bookings"
ON bookings FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'supervisor') OR
  has_role(auth.uid(), 'agent')
);

-- Update UPDATE policy to allow supervisors to edit bookings from their site's agents
-- and agents to edit their own bookings
DROP POLICY IF EXISTS "Admins and supervisors can update bookings" ON bookings;
CREATE POLICY "Users can update bookings based on role"
ON bookings FOR UPDATE
USING (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'admin') OR 
  (has_role(auth.uid(), 'supervisor') AND agent_id IN (
    SELECT id FROM agents WHERE site_id = get_user_site_id(auth.uid())
  )) OR
  (has_role(auth.uid(), 'agent') AND agent_id IN (
    SELECT id FROM agents WHERE user_id = auth.uid()
  ))
);