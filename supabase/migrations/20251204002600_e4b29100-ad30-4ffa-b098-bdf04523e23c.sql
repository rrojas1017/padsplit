-- Fix access_logs INSERT policy: Add validation to prevent log injection
DROP POLICY IF EXISTS "Authenticated users can create access logs" ON public.access_logs;

CREATE POLICY "Authenticated users can create access logs"
ON public.access_logs
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL AND
  (user_id IS NULL OR user_id = auth.uid())
);

-- Fix sites table: Restrict to authenticated users only
DROP POLICY IF EXISTS "Everyone can view sites" ON public.sites;

CREATE POLICY "Authenticated users can view sites"
ON public.sites
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);