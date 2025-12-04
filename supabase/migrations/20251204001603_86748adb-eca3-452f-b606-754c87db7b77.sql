-- Remove the public SELECT policy that exposes tokens
DROP POLICY IF EXISTS "Public can validate tokens" ON public.display_tokens;

-- Note: The "Admins can manage display tokens" policy already exists and handles admin access