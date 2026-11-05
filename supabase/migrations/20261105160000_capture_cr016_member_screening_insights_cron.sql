-- CR-016 (Member Screening setup): nightly AI summary job for script 247ead24,
-- same command as job nightly-script-insights-827b23ef (BUG-003) with the
-- script id and campaign_type swapped. Skips at no cost with <3 records.
SELECT cron.schedule(
  'nightly-script-insights-247ead24',
  '20 3 * * *',
  replace(
    replace(
      (SELECT command FROM cron.job WHERE jobname = 'nightly-script-insights-827b23ef'),
      '827b23ef-3f35-4108-8462-468bf6cf7872', '247ead24-6b86-4b19-b352-0493c1831ba9'),
    'script_827b23ef', 'script_247ead24')
);
