-- CR-005 (2026-09-25): link ViciDial screen-pop form submissions and API recordings of the same call.
-- Additive only: three nullable columns, one partial UNIQUE index (one research call per dialer call
-- per campaign), one partial index for the no-uniqueid fallback match on public (form) rows.

ALTER TABLE public.research_calls
  ADD COLUMN IF NOT EXISTS dialer_call_id text,
  ADD COLUMN IF NOT EXISTS dialer_lead_id text,
  ADD COLUMN IF NOT EXISTS dialer_agent_user text;

ALTER TABLE public.research_calls
  ADD CONSTRAINT research_calls_dialer_fields_len_check CHECK (
    (dialer_call_id IS NULL OR char_length(dialer_call_id) <= 64)
    AND (dialer_lead_id IS NULL OR char_length(dialer_lead_id) <= 64)
    AND (dialer_agent_user IS NULL OR char_length(dialer_agent_user) <= 64)
  );

CREATE UNIQUE INDEX IF NOT EXISTS research_calls_campaign_dialer_call_key
  ON public.research_calls (campaign_id, dialer_call_id)
  WHERE dialer_call_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_research_calls_public_fallback
  ON public.research_calls (campaign_id, dialer_agent_user, created_at)
  WHERE caller_type = 'public';

COMMENT ON COLUMN public.research_calls.dialer_call_id IS 'CR-005: ViciDial uniqueid of the call; links the screen-pop form and the API recording';
COMMENT ON COLUMN public.research_calls.dialer_lead_id IS 'CR-005: ViciDial lead_id (informational)';
COMMENT ON COLUMN public.research_calls.dialer_agent_user IS 'CR-005: ViciDial agent user as received (resolved to agents.dialer_agent_user)';

-- CR-005 (2026-09-25): at most one booking per research call (closes the form/recording double-insert race).
-- Verified before creation: 0 research_call_id values with more than one booking.
CREATE UNIQUE INDEX IF NOT EXISTS bookings_research_call_id_key
  ON public.bookings (research_call_id)
  WHERE research_call_id IS NOT NULL;
