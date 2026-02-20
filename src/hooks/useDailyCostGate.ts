import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DailyCostGateData {
  coachingBlocked: boolean;
  todayAvg: number;
  recordCount: number;
  isLoading: boolean;
}

const POLL_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

export function useDailyCostGate(): DailyCostGateData {
  const [state, setState] = useState<DailyCostGateData>({
    coachingBlocked: false,
    todayAvg: 0,
    recordCount: 0,
    isLoading: true,
  });

  const fetchGate = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_daily_coaching_gate');
      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        setState({
          coachingBlocked: !!row.is_blocked,
          todayAvg: Number(row.today_avg) || 0,
          recordCount: Number(row.record_count) || 0,
          isLoading: false,
        });
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    } catch {
      // Silently fail — non-admins may get permission errors if RPC is restricted
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    fetchGate();
    const interval = setInterval(fetchGate, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchGate]);

  return state;
}
