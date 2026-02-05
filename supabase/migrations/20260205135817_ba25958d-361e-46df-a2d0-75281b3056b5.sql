-- Fix overly permissive RLS policy for llm_prompt_enhancements
-- Drop the permissive "true" policy and create proper role-based policies

DROP POLICY IF EXISTS "Service role can manage llm_prompt_enhancements" ON public.llm_prompt_enhancements;

-- Super admins can manage (CRUD) prompt enhancements
CREATE POLICY "Super admins can manage llm_prompt_enhancements" 
ON public.llm_prompt_enhancements 
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.raw_user_meta_data->>'role' = 'super_admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.raw_user_meta_data->>'role' = 'super_admin'
  )
);