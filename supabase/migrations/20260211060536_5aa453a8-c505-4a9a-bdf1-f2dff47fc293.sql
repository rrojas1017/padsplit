
-- Table to track lifestyle signal backfill jobs
CREATE TABLE public.lifestyle_backfill_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'running',
  start_date text,
  end_date text,
  total_processed integer NOT NULL DEFAULT 0,
  total_failed integer NOT NULL DEFAULT 0,
  remaining integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lifestyle_backfill_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can read backfill jobs"
  ON public.lifestyle_backfill_jobs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can insert backfill jobs"
  ON public.lifestyle_backfill_jobs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can update backfill jobs"
  ON public.lifestyle_backfill_jobs FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));
