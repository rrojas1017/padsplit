-- CR-017: names for ViciDial lead lists per research campaign, and two
-- read-only lookups for the per-script survey insights "List" filter.
-- Same role scope as CR-015: super_admin/admin all calls; supervisors only
-- calls whose agent is on their own site. Returns ids, list ids and names only.
CREATE TABLE IF NOT EXISTS public.dialer_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.research_campaigns(id) ON DELETE CASCADE,
  list_id text NOT NULL CHECK (char_length(list_id) BETWEEN 1 AND 64),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dialer_lists_campaign_list_key UNIQUE (campaign_id, list_id)
);
COMMENT ON TABLE public.dialer_lists IS 'Display names of ViciDial lead lists (list_id) per research campaign (CR-017)';
ALTER TABLE public.dialer_lists ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dialer_lists FROM anon;
CREATE POLICY "Admins can view dialer lists" ON public.dialer_lists
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can manage dialer lists" ON public.dialer_lists
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER update_dialer_lists_updated_at
  BEFORE UPDATE ON public.dialer_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_script_survey_list_map(p_script_id uuid)
RETURNS TABLE(booking_id uuid, list_id text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id, rc.dialer_list_id
  FROM public.bookings b
  JOIN public.research_calls rc ON rc.id = b.research_call_id
  JOIN public.research_campaigns c ON c.id = rc.campaign_id
  LEFT JOIN public.agents a ON a.id = b.agent_id
  WHERE c.script_id = p_script_id
    AND b.record_type = 'research'
    AND rc.dialer_list_id IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'super_admin'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR (public.has_role(auth.uid(), 'supervisor'::public.app_role)
          AND a.site_id IS NOT NULL
          AND a.site_id = public.get_user_site_id(auth.uid()))
    )
  ORDER BY b.id
$$;

CREATE OR REPLACE FUNCTION public.get_script_lists(p_script_id uuid)
RETURNS TABLE(campaign_id uuid, list_id text, name text, sort_order integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.campaign_id, l.list_id, l.name, l.sort_order
  FROM public.dialer_lists l
  JOIN public.research_campaigns c ON c.id = l.campaign_id
  WHERE c.script_id = p_script_id
    AND (
      public.has_role(auth.uid(), 'super_admin'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'supervisor'::public.app_role)
    )
  ORDER BY l.sort_order, l.name
$$;

REVOKE ALL ON FUNCTION public.get_script_survey_list_map(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_script_lists(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_script_survey_list_map(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_script_lists(uuid) TO authenticated;
