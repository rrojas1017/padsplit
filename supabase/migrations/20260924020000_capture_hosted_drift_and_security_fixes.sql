-- QA remediation (Phases 1–2), 2026-09-24.
-- Captures objects that were changed directly in the hosted database (drift-log #1–15) and hosted-only
-- objects that never had a migration (voice_coaching_settings, bookings SELECT policy, ad-hoc indexes,
-- pg_cron jobs). Every statement is idempotent: running it on production is a no-op; running it on a
-- fresh database reproduces production.

-- ============ Helpers ============
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id) $function$;
REVOKE ALL ON FUNCTION public.has_any_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid) TO authenticated, service_role;

-- ============ #1 DB-01 profiles privileged columns ============
CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user NOT IN ('authenticated','anon') THEN RETURN NEW; END IF;
  IF public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin') THEN RETURN NEW; END IF;
  IF (to_jsonb(NEW) - ARRAY['name','avatar_url','updated_at'])
     IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['name','avatar_url','updated_at']) THEN
    RAISE EXCEPTION 'profiles: only name/avatar_url may be changed by the user' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION public.guard_profile_privileged_columns() FROM PUBLIC, anon;
DROP TRIGGER IF EXISTS guard_profile_privileged_columns ON public.profiles;
CREATE TRIGGER guard_profile_privileged_columns BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_columns();

-- ============ #2 DB-02 booking_transcriptions agent columns ============
CREATE OR REPLACE FUNCTION public.guard_bt_agent_columns()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE allowed text[] := ARRAY['coaching_audio_listened_at','qa_coaching_audio_listened_at',
                                'coaching_quiz_passed_at','qa_coaching_quiz_passed_at','updated_at'];
BEGIN
  IF current_user NOT IN ('authenticated','anon') THEN RETURN NEW; END IF;
  IF public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin')
     OR public.has_role(auth.uid(),'supervisor') THEN RETURN NEW; END IF;
  IF (to_jsonb(NEW) - allowed) IS DISTINCT FROM (to_jsonb(OLD) - allowed) THEN
    RAISE EXCEPTION 'booking_transcriptions: agents may only set listened/quiz timestamps' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION public.guard_bt_agent_columns() FROM PUBLIC, anon;
DROP TRIGGER IF EXISTS guard_bt_agent_columns ON public.booking_transcriptions;
CREATE TRIGGER guard_bt_agent_columns BEFORE UPDATE ON public.booking_transcriptions
  FOR EACH ROW EXECUTE FUNCTION public.guard_bt_agent_columns();

-- ============ #3 BKG-14 bookings INSERT; hosted-only SELECT policy ============
DROP POLICY IF EXISTS "Authenticated users can create bookings" ON public.bookings;
CREATE POLICY "Authenticated users can create bookings" ON public.bookings FOR INSERT TO authenticated
WITH CHECK (
  public.can_view_booking(agent_id)
  AND (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor') OR has_role(auth.uid(),'agent'))
  AND (created_by IS NULL OR created_by = auth.uid() OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'))
);
DROP POLICY IF EXISTS "Users can view bookings based on role" ON public.bookings;
CREATE POLICY "Users can view bookings based on role" ON public.bookings FOR SELECT USING (public.can_view_booking(agent_id));

-- ============ #4 DB-03, #5 SEC-17 ============
DROP POLICY IF EXISTS "Service role can insert conversation_submissions" ON public.conversation_submissions;
DROP POLICY IF EXISTS "Admins can insert api_credentials" ON public.api_credentials;
DROP POLICY IF EXISTS "Admins can update api_credentials" ON public.api_credentials;
DROP POLICY IF EXISTS "Admins can delete api_credentials" ON public.api_credentials;

-- ============ #6 DB-06 EXECUTE grants ============
REVOKE EXECUTE ON FUNCTION public.archive_old_api_costs() FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.claim_booking_for_transcription(uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.generate_invoice_number() FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.set_invoice_defaults() FROM authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.claim_booking_for_transcription(uuid), public.archive_old_api_costs() TO service_role;

-- ============ #7 DB-07 role-less users ============
ALTER POLICY "Authenticated users can view agents" ON public.agents USING (public.has_any_role(auth.uid()));
ALTER POLICY "Authenticated users can view sites" ON public.sites USING (public.has_any_role(auth.uid()));
ALTER POLICY "Authenticated users can read market intelligence cache" ON public.market_intelligence_cache USING (public.has_any_role(auth.uid()));
ALTER POLICY "Authenticated users can view active promo_codes" ON public.promo_codes USING (public.has_any_role(auth.uid()) AND is_active = true);
ALTER POLICY "Authenticated users can view active qa_settings" ON public.qa_settings USING (public.has_any_role(auth.uid()) AND is_active = true);
ALTER POLICY "Authenticated users can view active call_types" ON public.call_types USING (public.has_any_role(auth.uid()) AND is_active = true);
ALTER POLICY "Authenticated users can read coaching_settings" ON public.coaching_settings USING (public.has_any_role(auth.uid()));
ALTER POLICY "Authenticated users can view llm_prompt_enhancements" ON public.llm_prompt_enhancements USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));
ALTER POLICY "Authenticated can read script_responses" ON public.script_responses USING (public.has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'));

-- ============ #8 DB-04 storage ============
DROP POLICY IF EXISTS "Service role can manage coaching audio" ON storage.objects;
CREATE POLICY "Service role can manage coaching audio" ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'coaching-audio') WITH CHECK (bucket_id = 'coaching-audio');
DROP POLICY IF EXISTS "Authenticated users can view coaching audio" ON storage.objects;
CREATE POLICY "Authenticated users can view coaching audio" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'coaching-audio' AND public.has_any_role(auth.uid()));

-- ============ #9 S0 internal secret (Vault) + trigger functions ============
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'internal_function_secret') THEN
    PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'internal_function_secret',
                                'x-internal-secret for pg_cron/pg_net -> edge functions');
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.get_internal_function_secret()
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'vault'
AS $function$
  select decrypted_secret from vault.decrypted_secrets where name = 'internal_function_secret' limit 1
$function$;
REVOKE ALL ON FUNCTION public.get_internal_function_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_internal_function_secret() TO service_role;

CREATE OR REPLACE FUNCTION public.trigger_auto_transcription_on_insert()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.kixie_link IS NOT NULL AND NEW.transcription_status IS NULL THEN
    PERFORM net.http_post(
      url := 'https://qwddqoyewtozzdvfmavn.supabase.co/functions/v1/check-auto-transcription',
      body := jsonb_build_object('bookingId', NEW.id),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', public.get_internal_function_secret())
    );
    RAISE LOG '[Trigger] Queued transcription for booking % (kixie_link present)', NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.trigger_auto_transcription_on_update()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.kixie_link IS NOT NULL AND OLD.kixie_link IS NULL AND NEW.transcription_status IS NULL THEN
    PERFORM net.http_post(
      url := 'https://qwddqoyewtozzdvfmavn.supabase.co/functions/v1/check-auto-transcription',
      body := jsonb_build_object('bookingId', NEW.id),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', public.get_internal_function_secret())
    );
    RAISE LOG '[Trigger] Queued transcription for booking % (kixie_link added via update)', NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.trigger_notify_moved_in()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'Moved In' AND OLD.status IS DISTINCT FROM 'Moved In' THEN
    PERFORM net.http_post(
      url := 'https://qwddqoyewtozzdvfmavn.supabase.co/functions/v1/notify-moved-in',
      body := jsonb_build_object('bookingId', NEW.id),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', public.get_internal_function_secret())
    );
    RAISE LOG '[Trigger] Fired notify-moved-in for booking % (status -> Moved In)', NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.trigger_auto_transcription_on_insert(), public.trigger_auto_transcription_on_update(), public.trigger_notify_moved_in() FROM public, anon, authenticated;

-- ============ #10 SEC-16 API rate limit ============
CREATE TABLE IF NOT EXISTS public.api_rate_limit_windows(
  client_id text NOT NULL, window_start timestamptz NOT NULL, hits int NOT NULL DEFAULT 0,
  PRIMARY KEY (client_id, window_start));
ALTER TABLE public.api_rate_limit_windows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.api_rate_limit_windows FROM anon, authenticated;
CREATE OR REPLACE FUNCTION public.api_rate_limit_hit(p_client_id text, p_limit integer)
 RETURNS TABLE(allowed boolean, remaining integer, reset_at timestamp with time zone)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare w timestamptz := date_trunc('minute', now()); n int;
begin
  insert into api_rate_limit_windows(client_id, window_start, hits) values (p_client_id, w, 1)
  on conflict (client_id, window_start) do update set hits = api_rate_limit_windows.hits + 1
  returning hits into n;
  delete from api_rate_limit_windows where window_start < now() - interval '1 hour';
  return query select n <= p_limit, greatest(p_limit - n, 0), w + interval '1 minute';
end $function$;
REVOKE EXECUTE ON FUNCTION public.api_rate_limit_hit(text,int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_rate_limit_hit(text,int) TO service_role;

-- ============ #11 TRN-02, #12 TRN-01 ============
CREATE OR REPLACE FUNCTION public.bt_touch_updated_at_on_status()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.research_processing_status IS DISTINCT FROM OLD.research_processing_status
     OR NEW.call_transcription IS DISTINCT FROM OLD.call_transcription THEN
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS bt_touch_updated_at_on_status ON public.booking_transcriptions;
CREATE TRIGGER bt_touch_updated_at_on_status BEFORE UPDATE ON public.booking_transcriptions
  FOR EACH ROW EXECUTE FUNCTION public.bt_touch_updated_at_on_status();

CREATE OR REPLACE FUNCTION public.reap_stuck_transcriptions()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_q int; v_p int;
BEGIN
  UPDATE bookings SET transcription_status = 'failed',
         transcription_error_message = 'Auto-reset: stuck in queued > 30 min (dispatch to transcribe-call failed)'
   WHERE transcription_status = 'queued' AND updated_at < now() - interval '30 minutes';
  GET DIAGNOSTICS v_q = ROW_COUNT;
  UPDATE bookings SET transcription_status = 'failed',
         transcription_error_message = 'Auto-reset: stuck in processing > 20 min (worker killed or timed out)'
   WHERE transcription_status = 'processing' AND updated_at < now() - interval '20 minutes';
  GET DIAGNOSTICS v_p = ROW_COUNT;
  IF v_q + v_p > 0 THEN RAISE LOG '[reaper] queued=% processing=%', v_q, v_p; END IF;
  RETURN jsonb_build_object('queued', v_q, 'processing', v_p, 'at', now());
END $function$;
REVOKE ALL ON FUNCTION public.reap_stuck_transcriptions() FROM PUBLIC, anon, authenticated;

-- ============ #13 DB-11, #14 BKG-01 ============
ALTER TABLE public.agent_goals DROP CONSTRAINT IF EXISTS agent_goals_agent_id_key;
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check CHECK (status = ANY (ARRAY['Pending Move-In','Moved In','Member Rejected','No Show','Cancelled','Postponed','Non Booking','Research']));

-- ============ #15 DB-19 updated_at triggers ============
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['clients','coaching_settings','notification_settings','research_prompts','user_preferences'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = ('public.'||t)::regclass AND tgname = 'update_'||t||'_updated_at') THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', 'update_'||t||'_updated_at', t);
    END IF;
  END LOOP;
END $$;

-- ============ Hosted-only objects that never had a migration ============
CREATE TABLE IF NOT EXISTS public.voice_coaching_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coaching_tone text NOT NULL DEFAULT 'energetic',
  custom_expressions text[] DEFAULT '{}', always_emphasize text[] DEFAULT '{}', never_mention text[] DEFAULT '{}',
  voice_id text NOT NULL DEFAULT 'nPczCjzI2devNBz1zQrb',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid);
ALTER TABLE public.voice_coaching_settings ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings USING btree (status);
CREATE INDEX IF NOT EXISTS idx_profiles_site_id ON public.profiles USING btree (site_id);

-- pg_cron jobs (cron.schedule with an existing name updates the job in place)
SELECT cron.schedule('cleanup-coaching-audio-daily', '0 3 * * *', $cmd$
  SELECT net.http_post(
    url:='https://qwddqoyewtozzdvfmavn.supabase.co/functions/v1/cleanup-coaching-audio',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3ZGRxb3lld3RvenpkdmZtYXZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3ODYwNDIsImV4cCI6MjA4MDM2MjA0Mn0.Ss2z6qnU2W83go1P-Ja782RltqB1eBXy44M7xruF3vo"}'::jsonb || jsonb_build_object('x-internal-secret', public.get_internal_function_secret()),
    body:='{}'::jsonb
  ) as request_id;
  $cmd$);
SELECT cron.schedule('nightly-research-insights', '0 3 * * *', $cmd$
  SELECT net.http_post(
    url := 'https://qwddqoyewtozzdvfmavn.supabase.co/functions/v1/generate-research-insights',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3ZGRxb3lld3RvenpkdmZtYXZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3ODYwNDIsImV4cCI6MjA4MDM2MjA0Mn0.Ss2z6qnU2W83go1P-Ja782RltqB1eBXy44M7xruF3vo"}'::jsonb || jsonb_build_object('x-internal-secret', public.get_internal_function_secret()),
    body := '{"campaign_type": "move_out_survey", "automated": true, "analysis_period": "allTime"}'::jsonb
  );
  $cmd$);
SELECT cron.schedule('nightly-booking-insights', '0 3 * * *', $cmd$
  SELECT net.http_post(
    url:='https://qwddqoyewtozzdvfmavn.supabase.co/functions/v1/analyze-member-insights',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3ZGRxb3lld3RvenpkdmZtYXZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3ODYwNDIsImV4cCI6MjA4MDM2MjA0Mn0.Ss2z6qnU2W83go1P-Ja782RltqB1eBXy44M7xruF3vo"}'::jsonb || jsonb_build_object('x-internal-secret', public.get_internal_function_secret()),
    body:='{"analysis_period": "allTime", "automated": true}'::jsonb
  ) AS request_id;
  $cmd$);
SELECT cron.schedule('nightly-non-booking-insights', '5 3 * * *', $cmd$
  SELECT net.http_post(
    url:='https://qwddqoyewtozzdvfmavn.supabase.co/functions/v1/analyze-non-booking-insights',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3ZGRxb3lld3RvenpkdmZtYXZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3ODYwNDIsImV4cCI6MjA4MDM2MjA0Mn0.Ss2z6qnU2W83go1P-Ja782RltqB1eBXy44M7xruF3vo"}'::jsonb || jsonb_build_object('x-internal-secret', public.get_internal_function_secret()),
    body:='{"analysis_period": "allTime", "automated": true}'::jsonb
  ) AS request_id;
  $cmd$);
SELECT cron.schedule('archive-old-api-costs-weekly', '0 4 * * 0', $cmd$ SELECT public.archive_old_api_costs(); $cmd$);
SELECT cron.schedule('reap-stuck-transcriptions', '*/10 * * * *', $cmd$SELECT public.reap_stuck_transcriptions()$cmd$);
