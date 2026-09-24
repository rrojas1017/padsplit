-- CR-001 (2026-09-24): admins may edit supervisor, agent and researcher profiles
-- (name, site, communication permissions). Status, email and every other column,
-- and all super_admin/admin profiles, stay super_admin-only.

CREATE POLICY "Admins can update staff profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    AND public.get_user_role(id) IN ('supervisor'::public.app_role, 'agent'::public.app_role, 'researcher'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    AND public.get_user_role(id) IN ('supervisor'::public.app_role, 'agent'::public.app_role, 'researcher'::public.app_role)
  );

CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user NOT IN ('authenticated','anon') THEN RETURN NEW; END IF;
  IF public.has_role(auth.uid(),'super_admin') THEN RETURN NEW; END IF;
  IF public.has_role(auth.uid(),'admin') THEN
    IF NEW.id = auth.uid() THEN RETURN NEW; END IF;
    -- CR-001: an admin editing another user's profile may change only these columns
    IF (to_jsonb(NEW) - ARRAY['name','site_id','can_send_communications','can_send_email','can_send_sms','can_send_voice','updated_at'])
       IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['name','site_id','can_send_communications','can_send_email','can_send_sms','can_send_voice','updated_at']) THEN
      RAISE EXCEPTION 'profiles: admins may change only name, site and communication permissions of other users' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW) - ARRAY['name','avatar_url','updated_at'])
     IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['name','avatar_url','updated_at']) THEN
    RAISE EXCEPTION 'profiles: only name/avatar_url may be changed by the user' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $function$;
