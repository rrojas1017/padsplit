-- First, drop existing SELECT policies on profiles to recreate them properly
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create proper PERMISSIVE SELECT policies that explicitly require authentication
-- Policy 1: Users can view their own profile (must be authenticated)
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Policy 2: Admins and super_admins can view all profiles (must be authenticated with proper role)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Note: With these PERMISSIVE policies using "TO authenticated", 
-- unauthenticated/anon users cannot access any profile data