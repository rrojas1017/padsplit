-- Capture of drift #32 and #33 (BUG-002), applied directly on 2026-09-24.
-- #32: access_logs actions + password_change, user_deactivated, user_reactivated.
ALTER TABLE public.access_logs DROP CONSTRAINT access_logs_action_check;
ALTER TABLE public.access_logs ADD CONSTRAINT access_logs_action_check CHECK ((action = ANY (ARRAY['login'::text, 'logout'::text, 'view_dashboard'::text, 'export_csv'::text, 'role_change'::text, 'data_import'::text, 'view_reports'::text, 'view_member_insights'::text, 'view_coaching_hub'::text, 'view_leaderboard'::text, 'view_my_performance'::text, 'view_wallboard'::text, 'view_add_booking'::text, 'view_agent_status'::text, 'view_user_management'::text, 'view_display_links'::text, 'view_import_bookings'::text, 'view_audit_log'::text, 'view_settings'::text, 'view_edit_booking'::text, 'view_broadcasts'::text, 'view_coaching_engagement'::text, 'view_import'::text, 'view_market_intelligence'::text, 'view_my_bookings'::text, 'view_my_qa'::text, 'view_qa_dashboard'::text, 'communication_permission_grant'::text, 'communication_permission_revoke'::text, 'channel_permission_grant'::text, 'channel_permission_revoke'::text, 'api_credential_created'::text, 'api_credential_revoked'::text, 'api_credential_regenerated'::text, 'api_credential_deleted'::text, 'api_conversation_submitted'::text, 'blocked_login_ip'::text, 'login_ip_allowed'::text, 'password_reset'::text, 'password_change'::text, 'user_deactivated'::text, 'user_reactivated'::text]))) NOT VALID;
ALTER TABLE public.access_logs VALIDATE CONSTRAINT access_logs_action_check;
-- #33: revoke a user's auth sessions (service_role only).
CREATE OR REPLACE FUNCTION public.revoke_user_sessions(p_user_id uuid, p_keep_session_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  n integer;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;
  DELETE FROM auth.sessions s
   WHERE s.user_id = p_user_id
     AND (p_keep_session_id IS NULL OR s.id <> p_keep_session_id);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.revoke_user_sessions(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_user_sessions(uuid, uuid) TO service_role;
