
CREATE TABLE public.payment_experience_open_ended_cluster_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id text NOT NULL,
  response_hash text NOT NULL,
  model text NOT NULL,
  clusters jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (question_id, response_hash, model)
);

GRANT ALL ON public.payment_experience_open_ended_cluster_cache TO service_role;

ALTER TABLE public.payment_experience_open_ended_cluster_cache ENABLE ROW LEVEL SECURITY;

-- No authenticated/anon policies: the table is only accessed by the
-- cluster-pe-open-ended edge function using the service role.
CREATE POLICY "service_role_full_access"
  ON public.payment_experience_open_ended_cluster_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_pe_oe_cluster_cache_updated_at
  BEFORE UPDATE ON public.payment_experience_open_ended_cluster_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_pe_oe_cluster_cache_lookup
  ON public.payment_experience_open_ended_cluster_cache (question_id, response_hash, model);
