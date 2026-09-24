-- Captures direct production changes from drift-log #26-#30 (2026-09-24). Idempotent.
-- #26 (temporary storage DELETE policy for the orphan-audio cleanup) was created and dropped the same hour: net zero, not repeated.
-- Data changes (alerts read/resolved, move-in dates cleared, invoices voided, orphan audio deleted) are not repeated here.

-- #27 BIL-45: research and platform AI cost for the invoice generator (ET period, end inclusive)
CREATE OR REPLACE FUNCTION public.invoice_platform_costs(p_start date, p_end date)
RETURNS TABLE(research_cost numeric, research_rows bigint, platform_cost numeric, platform_rows bigint, archived_research_cost numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
declare t0 timestamptz := (p_start::timestamp at time zone 'America/New_York');
        t1 timestamptz := ((p_end + 1)::timestamp at time zone 'America/New_York');
begin
  if not public.has_role(auth.uid(), 'super_admin') then raise exception 'forbidden'; end if;
  return query
  with live as (
    select a.estimated_cost_usd c,
           (coalesce(a.service_type,'') like 'research%' or coalesce(b.record_type,'') = 'research') is_research,
           a.booking_id
      from api_costs a left join bookings b on b.id = a.booking_id
     where a.is_internal = false and a.created_at >= t0 and a.created_at < t1),
  arch as (
    select coalesce(sum(s.total_cost_usd),0)::numeric c
      from api_costs_monthly_summary s
     where s.is_internal = false and s.service_type like 'research%'
       and (s.month::timestamp at time zone 'America/New_York') >= t0 - interval '1 day'
       and coalesce((select min(a2.created_at) from api_costs a2 where a2.created_at >= s.month and a2.created_at < s.month + interval '1 month'),
                    ((s.month + interval '1 month')::timestamp at time zone 'America/New_York')) <= t1 + interval '1 day')
  select coalesce(sum(c) filter (where is_research),0)::numeric + (select c from arch),
         count(*) filter (where is_research)::bigint,
         coalesce(sum(c) filter (where not is_research and booking_id is null),0)::numeric,
         count(*) filter (where not is_research and booking_id is null)::bigint,
         (select c from arch)
    from live;
end $$;
REVOKE ALL ON FUNCTION public.invoice_platform_costs(date, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.invoice_platform_costs(date, date) TO authenticated;

-- #28 BIL-18 correction: archived summary rows never overlap live rows; count a summary month when the range covers its archived span
CREATE OR REPLACE FUNCTION public.billing_cost_summary(p_start timestamptz, p_end timestamptz)
RETURNS TABLE(service_provider text, service_type text, edge_function text, rows bigint, cost_usd numeric, source text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
begin
  if not public.has_role(auth.uid(), 'super_admin') then raise exception 'forbidden'; end if;
  return query
    select a.service_provider::text, a.service_type::text, a.edge_function::text, count(*)::bigint, sum(a.estimated_cost_usd)::numeric, 'live'::text
      from api_costs a where a.is_internal=false and a.created_at >= p_start and a.created_at < p_end group by 1,2,3
    union all
    -- archived rows were deleted from api_costs, so summary + live never overlap. A summary month is counted
    -- when the range covers its archived span: [month start, first live row of that month or month end).
    select s.service_provider::text, s.service_type::text, null::text, sum(s.record_count)::bigint, sum(s.total_cost_usd)::numeric, 'archived'::text
      from api_costs_monthly_summary s
     where s.is_internal=false
       and (s.month::timestamp at time zone 'America/New_York') >= p_start - interval '1 day'
       and coalesce((select min(a2.created_at) from api_costs a2 where a2.created_at >= s.month and a2.created_at < s.month + interval '1 month'),
                    ((s.month + interval '1 month')::timestamp at time zone 'America/New_York')) <= p_end + interval '1 day'
     group by 1,2;
end $$;
REVOKE ALL ON FUNCTION public.billing_cost_summary(timestamptz, timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.billing_cost_summary(timestamptz, timestamptz) TO authenticated;

-- #29 BIL-23: void status, status-transition guard, no overlapping non-void invoices per client
ALTER TABLE public.billing_invoices DROP CONSTRAINT IF EXISTS billing_invoices_status_check;
ALTER TABLE public.billing_invoices ADD CONSTRAINT billing_invoices_status_check CHECK (status = ANY (ARRAY['draft','sent','paid','void']::text[]));
CREATE OR REPLACE FUNCTION public.guard_invoice_status_transition() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
begin
  if NEW.status is distinct from OLD.status then
    if OLD.status = 'void' then raise exception 'A void invoice cannot change status' using errcode = 'check_violation'; end if;
    if OLD.status = 'paid' and NEW.status in ('draft','sent') then raise exception 'A paid invoice cannot go back to %', NEW.status using errcode = 'check_violation'; end if;
  end if;
  return NEW;
end $$;
DROP TRIGGER IF EXISTS guard_invoice_status_transition ON public.billing_invoices;
CREATE TRIGGER guard_invoice_status_transition BEFORE UPDATE OF status ON public.billing_invoices FOR EACH ROW EXECUTE FUNCTION public.guard_invoice_status_transition();
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'billing_invoices_no_overlap') THEN
    ALTER TABLE public.billing_invoices ADD CONSTRAINT billing_invoices_no_overlap
      EXCLUDE USING gist (client_id WITH =, daterange(period_start, period_end, '[]') WITH &&) WHERE (status <> 'void');
  END IF;
END $$;

-- #30 BKG-07: move_in_date may be unknown (HubSpot imports carry none)
ALTER TABLE public.bookings ALTER COLUMN move_in_date DROP NOT NULL;

NOTIFY pgrst, 'reload schema';
