-- Captures direct production changes from drift-log #21-#25 (2026-09-24). Idempotent.

-- #21 INS-09/10: non-booking stats with an end bound + hot leads
DROP FUNCTION IF EXISTS public.get_non_booking_stats(date);
CREATE OR REPLACE FUNCTION public.get_non_booking_stats(start_date date DEFAULT NULL, end_date date DEFAULT NULL)
RETURNS TABLE(total_calls bigint, transcribed_calls bigint, high_readiness_calls bigint, avg_duration_seconds numeric, hot_leads bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select count(*)::bigint,
         count(*) filter (where b.transcription_status = 'completed')::bigint,
         count(*) filter (where b.call_duration_seconds > 300)::bigint,
         coalesce(avg(b.call_duration_seconds) filter (where b.call_duration_seconds > 0), 0)::numeric,
         count(*) filter (where exists (select 1 from booking_transcriptions bt
                          where bt.booking_id = b.id
                            and jsonb_typeof(bt.call_key_points->'buyerIntent'->'score') = 'number'
                            and (bt.call_key_points->'buyerIntent'->>'score')::numeric >= 75))::bigint
  from bookings b
  where b.status = 'Non Booking'
    and (start_date is null or b.booking_date >= start_date)
    and (end_date   is null or b.booking_date <= end_date);
$$;
REVOKE ALL ON FUNCTION public.get_non_booking_stats(date, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_non_booking_stats(date, date) TO authenticated, service_role;

-- #22 BIL-25: stop the weekly archive that deleted per-booking cost rows
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'archive-old-api-costs-weekly') THEN
    PERFORM cron.unschedule('archive-old-api-costs-weekly');
  END IF;
END $$;

-- #23 BIL-18: server-side billing totals (live rows + monthly summary for fully archived months)
CREATE OR REPLACE FUNCTION public.billing_cost_summary(p_start timestamptz, p_end timestamptz)
RETURNS TABLE(service_provider text, service_type text, edge_function text, rows bigint, cost_usd numeric, source text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
begin
  if not public.has_role(auth.uid(), 'super_admin') then raise exception 'forbidden'; end if;
  return query
    select a.service_provider::text, a.service_type::text, a.edge_function::text, count(*)::bigint, sum(a.estimated_cost_usd)::numeric, 'live'::text
      from api_costs a where a.is_internal=false and a.created_at >= p_start and a.created_at < p_end group by 1,2,3
    union all
    select s.service_provider::text, s.service_type::text, null::text, sum(s.record_count)::bigint, sum(s.total_cost_usd)::numeric, 'archived'::text
      from api_costs_monthly_summary s where s.is_internal=false and s.month >= date_trunc('month',p_start) and s.month < p_end
        and not exists (select 1 from api_costs a2 where a2.created_at >= s.month and a2.created_at < s.month + interval '1 month')
      group by 1,2;
end $$;
REVOKE ALL ON FUNCTION public.billing_cost_summary(timestamptz, timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.billing_cost_summary(timestamptz, timestamptz) TO authenticated;

-- #24 QA backup table (service role only)
CREATE TABLE IF NOT EXISTS public.qa_backups (
  id bigserial PRIMARY KEY,
  taken_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  ref_id text,
  payload jsonb NOT NULL
);
ALTER TABLE public.qa_backups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.qa_backups FROM anon, authenticated;

-- #25 SEC-23: access_logs rows must belong to the caller
ALTER POLICY "Authenticated users can create access logs" ON public.access_logs
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
