UPDATE public.lifestyle_backfill_jobs
SET status = 'failed', completed_at = NOW()
WHERE status = 'running'
  AND started_at < NOW() - INTERVAL '10 minutes';