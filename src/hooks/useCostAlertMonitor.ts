import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type CostAlertLevel = 'normal' | 'warning' | 'critical';

export interface BookingCostRecord {
  booking_id: string;
  total_cost: number;
  created_at: string;
}

export interface CostAlertData {
  alertLevel: CostAlertLevel;
  rollingAvg: number;
  recordCount: number;
  recentRecords: BookingCostRecord[];
  padSplitCharge: number;
  threshold: number;
  warningThreshold: number;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refetch: () => void;
}

const THRESHOLD_CRITICAL = 0.07;   // $0.07 — exceeds margin
const THRESHOLD_WARNING = 0.05;    // $0.05 — approaching limit
const PADSPLIT_CHARGE = 0.15;      // $0.15 charged to PadSplit per record
const ROLLING_WINDOW = 20;         // last N unique bookings
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function classifyLevel(avg: number): CostAlertLevel {
  if (avg > THRESHOLD_CRITICAL) return 'critical';
  if (avg > THRESHOLD_WARNING) return 'warning';
  return 'normal';
}

export function useCostAlertMonitor(): CostAlertData {
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole(['super_admin']);

  const [state, setState] = useState<Omit<CostAlertData, 'refetch'>>({
    alertLevel: 'normal',
    rollingAvg: 0,
    recordCount: 0,
    recentRecords: [],
    padSplitCharge: PADSPLIT_CHARGE,
    threshold: THRESHOLD_CRITICAL,
    warningThreshold: THRESHOLD_WARNING,
    isLoading: true,
    error: null,
    lastUpdated: null,
  });

  const fetchData = useCallback(async () => {
    if (!isSuperAdmin) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      // Fetch last 500 non-internal cost rows — enough to find 20 unique bookings
      const { data: costs, error } = await supabase
        .from('api_costs')
        .select('booking_id, estimated_cost_usd, created_at')
        .eq('is_internal', false)
        .not('service_type', 'like', 'tts_%') // exclude TTS for core pipeline avg
        .not('booking_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      // Group by booking_id, preserving insertion order (most recent first)
      const bookingMap = new Map<string, { total: number; created_at: string }>();
      for (const c of (costs || [])) {
        if (!c.booking_id) continue;
        const existing = bookingMap.get(c.booking_id);
        if (existing) {
          existing.total += c.estimated_cost_usd || 0;
        } else {
          bookingMap.set(c.booking_id, {
            total: c.estimated_cost_usd || 0,
            created_at: c.created_at || new Date().toISOString(),
          });
        }
      }

      // Take the last ROLLING_WINDOW unique bookings
      const allRecords: BookingCostRecord[] = Array.from(bookingMap.entries())
        .slice(0, ROLLING_WINDOW)
        .map(([booking_id, { total, created_at }]) => ({
          booking_id,
          total_cost: total,
          created_at,
        }));

      const rollingAvg = allRecords.length > 0
        ? allRecords.reduce((sum, r) => sum + r.total_cost, 0) / allRecords.length
        : 0;

      setState({
        alertLevel: classifyLevel(rollingAvg),
        rollingAvg,
        recordCount: allRecords.length,
        recentRecords: allRecords,
        padSplitCharge: PADSPLIT_CHARGE,
        threshold: THRESHOLD_CRITICAL,
        warningThreshold: THRESHOLD_WARNING,
        isLoading: false,
        error: null,
        lastUpdated: new Date(),
      });
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch cost data',
      }));
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { ...state, refetch: fetchData };
}
