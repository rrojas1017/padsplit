-- CR-016: ViciDial list_id per research call (sent by the recording upload
-- as listId and by the screen-pop URL as list). Untrusted dialer value,
-- cleaned by the intake functions; additive only.
ALTER TABLE public.research_calls ADD COLUMN IF NOT EXISTS dialer_list_id text;
ALTER TABLE public.research_calls
  ADD CONSTRAINT research_calls_dialer_list_len_check
  CHECK (dialer_list_id IS NULL OR char_length(dialer_list_id) <= 64) NOT VALID;
ALTER TABLE public.research_calls VALIDATE CONSTRAINT research_calls_dialer_list_len_check;
COMMENT ON COLUMN public.research_calls.dialer_list_id IS 'ViciDial list_id of the lead (CR-016); from the recording upload listId or the screen-pop list parameter; untrusted, cleaned, <=64 chars';
