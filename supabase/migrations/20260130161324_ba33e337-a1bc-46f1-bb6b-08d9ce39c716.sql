-- Create broadcast_messages table
CREATE TABLE public.broadcast_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  is_active boolean DEFAULT true,
  priority integer DEFAULT 0,
  site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
  target_role text DEFAULT 'agent' CHECK (target_role IN ('all', 'agent'))
);

-- Enable Row Level Security
ALTER TABLE public.broadcast_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read active broadcasts that apply to them
CREATE POLICY "Users can read active broadcasts"
  ON public.broadcast_messages FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND (
      site_id IS NULL 
      OR site_id = public.get_my_site_id()
    )
    AND (target_role = 'all' OR target_role = 'agent')
  );

-- Policy: Supervisors+ can read all broadcasts for management
CREATE POLICY "Managers can read all broadcasts"
  ON public.broadcast_messages FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() IN ('super_admin', 'admin', 'supervisor')
  );

-- Policy: Supervisors+ can manage broadcasts
CREATE POLICY "Managers can manage broadcasts"
  ON public.broadcast_messages FOR ALL
  TO authenticated
  USING (
    public.get_my_role() IN ('super_admin', 'admin', 'supervisor')
  )
  WITH CHECK (
    public.get_my_role() IN ('super_admin', 'admin', 'supervisor')
  );

-- Enable realtime for instant updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcast_messages;