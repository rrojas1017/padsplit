import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const TRACKING_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export function usePageTracking(action: string) {
  const { user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!user?.id) return;

    const trackingKey = `page_track_${action}_${user.id}`;
    const lastTracked = sessionStorage.getItem(trackingKey);
    const now = Date.now();

    // Deduplicate: only log once per 5-minute window per page
    if (lastTracked && now - parseInt(lastTracked) < TRACKING_WINDOW_MS) {
      return;
    }

    // Log the page visit
    const logPageVisit = async () => {
      try {
        await supabase.from('access_logs').insert({
          user_id: user.id,
          user_name: user.name || user.email,
          action,
          resource: location.pathname,
        });
        sessionStorage.setItem(trackingKey, now.toString());
      } catch (error) {
        console.error('Failed to log page visit:', error);
      }
    };

    logPageVisit();
  }, [action, user?.id, location.pathname]);
}
