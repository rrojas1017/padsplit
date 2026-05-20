-- 1. Fix llm_prompt_enhancements privilege escalation
DROP POLICY IF EXISTS "Super admins can manage llm_prompt_enhancements" ON public.llm_prompt_enhancements;
CREATE POLICY "Super admins can manage llm_prompt_enhancements"
ON public.llm_prompt_enhancements
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 2. Restrict market_intelligence_cache manage policy to service_role
DROP POLICY IF EXISTS "Service role can manage market intelligence cache" ON public.market_intelligence_cache;
CREATE POLICY "Service role can manage market intelligence cache"
ON public.market_intelligence_cache
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 3. Revoke EXECUTE from anon on flagged SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.archive_old_api_costs() FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_view_booking(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_booking_for_transcription(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_invoice_number() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_agent_user_ids_for_site(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_daily_coaching_gate() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_import_batch_counts() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_site_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_non_booking_stats(date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_non_booking_trends(date, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_site_id(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_agent(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_invoice_defaults() FROM anon;