-- CR-015: campaign lookup for the per-script survey insights, readable by
-- super_admin/admin (all research calls) and supervisors (only calls whose
-- agent is on their own site — the same scope as booking_transcriptions RLS).
-- Returns ids and campaign names only; no caller data.
CREATE OR REPLACE FUNCTION public.get_script_survey_campaign_map(p_script_id uuid)
RETURNS TABLE(booking_id uuid, campaign_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id, rc.campaign_id
  FROM public.bookings b
  JOIN public.research_calls rc ON rc.id = b.research_call_id
  JOIN public.research_campaigns c ON c.id = rc.campaign_id
  LEFT JOIN public.agents a ON a.id = b.agent_id
  WHERE c.script_id = p_script_id
    AND b.record_type = 'research'
    AND (
      public.has_role(auth.uid(), 'super_admin'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR (public.has_role(auth.uid(), 'supervisor'::public.app_role)
          AND a.site_id IS NOT NULL
          AND a.site_id = public.get_user_site_id(auth.uid()))
    )
  ORDER BY b.id
$$;

CREATE OR REPLACE FUNCTION public.get_script_campaigns(p_script_id uuid)
RETURNS TABLE(id uuid, name text, campaign_key text, status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.campaign_key, c.status
  FROM public.research_campaigns c
  WHERE c.script_id = p_script_id
    AND (
      public.has_role(auth.uid(), 'super_admin'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'supervisor'::public.app_role)
    )
  ORDER BY c.name
$$;

REVOKE ALL ON FUNCTION public.get_script_survey_campaign_map(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_script_campaigns(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_script_survey_campaign_map(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_script_campaigns(uuid) TO authenticated;
