
ALTER TABLE public.api_costs
  ADD COLUMN triggered_by_user_id UUID,
  ADD COLUMN is_internal BOOLEAN NOT NULL DEFAULT false;
