
-- Phase 1C: relax NOT NULL on research_calls columns that are only meaningful
-- in the human-researcher workflow. API submissions and the deterministic
-- backfill don't have natural values for these.
ALTER TABLE public.research_calls ALTER COLUMN researcher_id DROP NOT NULL;
ALTER TABLE public.research_calls ALTER COLUMN caller_name DROP NOT NULL;
ALTER TABLE public.research_calls ALTER COLUMN call_outcome DROP NOT NULL;

-- Temporary verification credential for Phase 1C live-submission test.
-- secret = 'phase1c-verify-2026-05-15-secret' (sha256 below). Will be deleted
-- after verification.
INSERT INTO public.api_credentials (
  client_id, client_secret_hash, application_name, status
) VALUES (
  'phase1c-verify-2026-05-15',
  '6212ed61bcdba8a47e561b07611e707c902db7f4accda909d391658ad4d1c62f',
  'Phase 1C Verification (temporary)',
  'active'
);
