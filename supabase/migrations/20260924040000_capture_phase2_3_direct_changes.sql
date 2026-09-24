-- Captures direct production changes from drift-log #16, #18, #19 and #20 (2026-09-24).
-- Idempotent: a no-op on production, where these objects already exist in this form.
-- #17 (question ids added to legacy scripts) was a data fix and is not repeated here.

-- #16 SEC-30: access_logs action CHECK covers every action the code writes
ALTER TABLE public.access_logs DROP CONSTRAINT IF EXISTS access_logs_action_check;
ALTER TABLE public.access_logs ADD CONSTRAINT access_logs_action_check CHECK (action = ANY (ARRAY[
  'login','logout','view_dashboard','export_csv','role_change','data_import','view_reports',
  'view_member_insights','view_coaching_hub','view_leaderboard','view_my_performance','view_wallboard',
  'view_add_booking','view_agent_status','view_user_management','view_display_links','view_import_bookings',
  'view_audit_log','view_settings','view_edit_booking','view_broadcasts','view_coaching_engagement',
  'view_import','view_market_intelligence','view_my_bookings','view_my_qa','view_qa_dashboard',
  'communication_permission_grant','communication_permission_revoke','channel_permission_grant',
  'channel_permission_revoke','api_credential_created','api_credential_revoked','api_credential_regenerated',
  'api_credential_deleted','api_conversation_submitted','blocked_login_ip','login_ip_allowed'
]::text[])) NOT VALID;
ALTER TABLE public.access_logs VALIDATE CONSTRAINT access_logs_action_check;

-- #18 RES-08: research_prompts.campaign_type (which campaign type a prompt serves)
ALTER TABLE public.research_prompts ADD COLUMN IF NOT EXISTS campaign_type text;
UPDATE public.research_prompts SET campaign_type = 'move_out_survey'
  WHERE prompt_key IN ('merged','extraction','classification') AND campaign_type IS NULL;
UPDATE public.research_prompts SET campaign_type = 'inactive'
  WHERE prompt_key = 'aggregation' AND campaign_type IS NULL;

-- #19 RES-03 / DB-18: research_calls CHECKs accept the values the UI and public page write
ALTER TABLE public.research_calls DROP CONSTRAINT IF EXISTS research_calls_caller_type_check;
ALTER TABLE public.research_calls ADD CONSTRAINT research_calls_caller_type_check CHECK (caller_type = ANY (ARRAY[
  'existing_member','former_booking','rejected','rejected_lead','public'
]::text[])) NOT VALID;
ALTER TABLE public.research_calls VALIDATE CONSTRAINT research_calls_caller_type_check;

ALTER TABLE public.research_calls DROP CONSTRAINT IF EXISTS research_calls_call_outcome_check;
ALTER TABLE public.research_calls ADD CONSTRAINT research_calls_call_outcome_check CHECK (call_outcome = ANY (ARRAY[
  'completed','no_answer','refused','callback_requested','transferred',
  'caller_hung_up','caller_stopped','wrong_number','technical_issue','ended_early'
]::text[])) NOT VALID;
ALTER TABLE public.research_calls VALIDATE CONSTRAINT research_calls_call_outcome_check;

-- #20 DB-05: coaching audio is served only through signed URLs
UPDATE storage.buckets SET public = false WHERE id = 'coaching-audio' AND public IS DISTINCT FROM false;

NOTIFY pgrst, 'reload schema';
