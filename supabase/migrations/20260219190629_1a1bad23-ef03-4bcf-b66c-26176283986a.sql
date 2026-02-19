
-- Add dialer_agent_user field to agents table
ALTER TABLE public.agents ADD COLUMN dialer_agent_user text;

-- Create unique index for agent matching (only non-null values)
CREATE UNIQUE INDEX idx_agents_dialer_agent_user ON public.agents (dialer_agent_user) WHERE dialer_agent_user IS NOT NULL;

-- Create conversation_submissions table for API audit trail
CREATE TABLE public.conversation_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  audio_url text NOT NULL,
  dialer_agent_user text NOT NULL,
  phone_number text NOT NULL,
  campaign text NOT NULL,
  submission_type text NOT NULL DEFAULT 'research',
  matched_agent_id uuid REFERENCES public.agents(id),
  api_credential_id uuid REFERENCES public.api_credentials(id),
  booking_id uuid REFERENCES public.bookings(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.conversation_submissions ENABLE ROW LEVEL SECURITY;

-- RLS: Admins can view all submissions
CREATE POLICY "Admins can view conversation_submissions"
  ON public.conversation_submissions FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- RLS: Service role inserts (edge function uses service role)
CREATE POLICY "Service role can insert conversation_submissions"
  ON public.conversation_submissions FOR INSERT
  WITH CHECK (true);

-- Index for reporting performance
CREATE INDEX idx_conversation_submissions_created_at ON public.conversation_submissions (created_at DESC);
CREATE INDEX idx_conversation_submissions_campaign ON public.conversation_submissions (campaign);
CREATE INDEX idx_conversation_submissions_matched_agent ON public.conversation_submissions (matched_agent_id);
