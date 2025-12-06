-- Optimize the can_view_booking function with PL/pgSQL for caching
CREATE OR REPLACE FUNCTION public.can_view_booking(booking_agent_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_role text;
  user_site uuid;
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  -- Fast path: get user role first (single lookup, cached per statement)
  SELECT role INTO user_role 
  FROM user_roles 
  WHERE user_id = current_user_id 
  LIMIT 1;
  
  -- Super admin or admin can view all (fastest check)
  IF user_role IN ('super_admin', 'admin') THEN
    RETURN true;
  END IF;
  
  -- For agents: check if this is their own booking
  IF user_role = 'agent' THEN
    RETURN EXISTS (
      SELECT 1 FROM agents 
      WHERE id = booking_agent_id 
      AND user_id = current_user_id
    );
  END IF;
  
  -- For supervisors: check site access
  IF user_role = 'supervisor' THEN
    SELECT site_id INTO user_site
    FROM profiles
    WHERE id = current_user_id;
    
    RETURN EXISTS (
      SELECT 1 FROM agents 
      WHERE id = booking_agent_id 
      AND site_id = user_site
    );
  END IF;
  
  RETURN false;
END;
$$;