-- ── Monthly summary table for archived api_costs ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_costs_monthly_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month date NOT NULL,
  service_type text NOT NULL,
  service_provider text NOT NULL,
  is_internal boolean NOT NULL DEFAULT false,
  record_count bigint NOT NULL DEFAULT 0,
  total_cost_usd numeric NOT NULL DEFAULT 0,
  total_input_tokens bigint NOT NULL DEFAULT 0,
  total_output_tokens bigint NOT NULL DEFAULT 0,
  total_audio_seconds bigint NOT NULL DEFAULT 0,
  total_characters bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (month, service_type, service_provider, is_internal)
);

CREATE INDEX IF NOT EXISTS idx_api_costs_monthly_summary_month
  ON public.api_costs_monthly_summary (month DESC);

ALTER TABLE public.api_costs_monthly_summary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can view api_costs_monthly_summary"
  ON public.api_costs_monthly_summary;
CREATE POLICY "Super admins can view api_costs_monthly_summary"
  ON public.api_costs_monthly_summary
  FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role));

DROP TRIGGER IF EXISTS update_api_costs_monthly_summary_updated_at
  ON public.api_costs_monthly_summary;
CREATE TRIGGER update_api_costs_monthly_summary_updated_at
  BEFORE UPDATE ON public.api_costs_monthly_summary
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ── Archive function ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.archive_old_api_costs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff timestamptz := now() - interval '90 days';
  v_aggregated_groups integer := 0;
  v_deleted_rows integer := 0;
BEGIN
  WITH agg AS (
    SELECT
      date_trunc('month', created_at)::date AS month,
      service_type,
      service_provider,
      is_internal,
      count(*)::bigint AS record_count,
      coalesce(sum(estimated_cost_usd), 0) AS total_cost_usd,
      coalesce(sum(input_tokens), 0)::bigint AS total_input_tokens,
      coalesce(sum(output_tokens), 0)::bigint AS total_output_tokens,
      coalesce(sum(audio_duration_seconds), 0)::bigint AS total_audio_seconds,
      coalesce(sum(character_count), 0)::bigint AS total_characters
    FROM public.api_costs
    WHERE created_at < v_cutoff
    GROUP BY 1, 2, 3, 4
  ),
  upserted AS (
    INSERT INTO public.api_costs_monthly_summary (
      month, service_type, service_provider, is_internal,
      record_count, total_cost_usd,
      total_input_tokens, total_output_tokens,
      total_audio_seconds, total_characters
    )
    SELECT
      month, service_type, service_provider, is_internal,
      record_count, total_cost_usd,
      total_input_tokens, total_output_tokens,
      total_audio_seconds, total_characters
    FROM agg
    ON CONFLICT (month, service_type, service_provider, is_internal)
    DO UPDATE SET
      record_count        = api_costs_monthly_summary.record_count        + EXCLUDED.record_count,
      total_cost_usd      = api_costs_monthly_summary.total_cost_usd      + EXCLUDED.total_cost_usd,
      total_input_tokens  = api_costs_monthly_summary.total_input_tokens  + EXCLUDED.total_input_tokens,
      total_output_tokens = api_costs_monthly_summary.total_output_tokens + EXCLUDED.total_output_tokens,
      total_audio_seconds = api_costs_monthly_summary.total_audio_seconds + EXCLUDED.total_audio_seconds,
      total_characters    = api_costs_monthly_summary.total_characters    + EXCLUDED.total_characters,
      updated_at          = now()
    RETURNING 1
  )
  SELECT count(*) INTO v_aggregated_groups FROM upserted;

  WITH del AS (
    DELETE FROM public.api_costs
    WHERE created_at < v_cutoff
    RETURNING 1
  )
  SELECT count(*) INTO v_deleted_rows FROM del;

  RETURN jsonb_build_object(
    'cutoff', v_cutoff,
    'aggregated_groups', v_aggregated_groups,
    'deleted_rows', v_deleted_rows,
    'ran_at', now()
  );
END;
$$;