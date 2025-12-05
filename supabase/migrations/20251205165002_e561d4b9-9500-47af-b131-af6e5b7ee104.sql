-- Create agent_sessions table for tracking login status
CREATE TABLE public.agent_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  login_time timestamptz NOT NULL DEFAULT now(),
  last_activity timestamptz NOT NULL DEFAULT now(),
  logout_time timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.agent_sessions ENABLE ROW LEVEL SECURITY;

-- Super admins and admins can view all sessions
CREATE POLICY "Admins can view all sessions"
ON public.agent_sessions FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Supervisors can view sessions for agents in their site
CREATE POLICY "Supervisors can view their site sessions"
ON public.agent_sessions FOR SELECT
USING (
  has_role(auth.uid(), 'supervisor'::app_role) AND 
  agent_id IN (
    SELECT id FROM public.agents WHERE site_id = get_user_site_id(auth.uid())
  )
);

-- Users can manage their own sessions
CREATE POLICY "Users can manage own sessions"
ON public.agent_sessions FOR ALL
USING (user_id = auth.uid());

-- Create index for performance
CREATE INDEX idx_agent_sessions_user_id ON public.agent_sessions(user_id);
CREATE INDEX idx_agent_sessions_is_active ON public.agent_sessions(is_active);
CREATE INDEX idx_agent_sessions_agent_id ON public.agent_sessions(agent_id);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_sessions;