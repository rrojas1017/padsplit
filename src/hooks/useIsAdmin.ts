import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

let cachedResult: boolean | null = null;
let cacheUserId: string | null = null;

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) { setLoading(false); return; }

      if (cacheUserId === user.id && cachedResult !== null) {
        setIsAdmin(cachedResult);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      const result = data?.role === 'super_admin' || data?.role === 'admin';
      cachedResult = result;
      cacheUserId = user.id;
      setIsAdmin(result);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { isAdmin, loading };
}
