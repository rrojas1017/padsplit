-- Create booking_edit_logs table to track all booking edits with reasons
CREATE TABLE public.booking_edit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.agents(id),
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  field_changed TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  edit_reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.booking_edit_logs ENABLE ROW LEVEL SECURITY;

-- Agents can view their own edit logs
CREATE POLICY "Agents can view their own edit logs"
ON public.booking_edit_logs
FOR SELECT
USING (user_id = auth.uid());

-- Agents can create edit logs for their own bookings
CREATE POLICY "Agents can create edit logs"
ON public.booking_edit_logs
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Admins can view all edit logs
CREATE POLICY "Admins can view all edit logs"
ON public.booking_edit_logs
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Supervisors can view edit logs for their site
CREATE POLICY "Supervisors can view site edit logs"
ON public.booking_edit_logs
FOR SELECT
USING (
  has_role(auth.uid(), 'supervisor'::app_role) AND
  agent_id IN (
    SELECT id FROM public.agents WHERE site_id = get_user_site_id(auth.uid())
  )
);

-- Create index for efficient queries
CREATE INDEX idx_booking_edit_logs_booking ON public.booking_edit_logs(booking_id);
CREATE INDEX idx_booking_edit_logs_user ON public.booking_edit_logs(user_id);
CREATE INDEX idx_booking_edit_logs_agent ON public.booking_edit_logs(agent_id);
CREATE INDEX idx_booking_edit_logs_created ON public.booking_edit_logs(created_at DESC);