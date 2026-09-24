-- Capture of drift #34 (BUG-003), applied directly on 2026-09-24. Nightly AI summaries for research scripts
-- without a dedicated dashboard. pg_cron upserts by job name, so this is a no-op on production.
-- The function skips at no cost when there are fewer than 3 eligible records or no new records since the last summary.
SELECT cron.schedule('nightly-script-insights-827b23ef', '10 3 * * *', $cmd$
  SELECT net.http_post(
    url := 'https://qwddqoyewtozzdvfmavn.supabase.co/functions/v1/generate-research-insights',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3ZGRxb3lld3RvenpkdmZtYXZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3ODYwNDIsImV4cCI6MjA4MDM2MjA0Mn0.Ss2z6qnU2W83go1P-Ja782RltqB1eBXy44M7xruF3vo"}'::jsonb || jsonb_build_object('x-internal-secret', public.get_internal_function_secret()),
    body := '{"campaign_type": "script_827b23ef", "script_id": "827b23ef-3f35-4108-8462-468bf6cf7872", "automated": true}'::jsonb
  );
$cmd$);
SELECT cron.schedule('nightly-script-insights-c24c5e6b', '15 3 * * *', $cmd$
  SELECT net.http_post(
    url := 'https://qwddqoyewtozzdvfmavn.supabase.co/functions/v1/generate-research-insights',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3ZGRxb3lld3RvenpkdmZtYXZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3ODYwNDIsImV4cCI6MjA4MDM2MjA0Mn0.Ss2z6qnU2W83go1P-Ja782RltqB1eBXy44M7xruF3vo"}'::jsonb || jsonb_build_object('x-internal-secret', public.get_internal_function_secret()),
    body := '{"campaign_type": "script_c24c5e6b", "script_id": "c24c5e6b-c7d8-43c6-86d5-affea47178bf", "automated": true}'::jsonb
  );
$cmd$);
