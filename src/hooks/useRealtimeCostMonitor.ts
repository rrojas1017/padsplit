import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { subMinutes, format } from 'date-fns';

interface ApiCostEntry {
  id: string;
  created_at: string;
  service_type: string;
  service_provider: string;
  estimated_cost_usd: number;
  edge_function: string;
}

interface MinuteTrend {
  minute: string;
  tts: number;
  stt: number;
  ai: number;
  total: number;
}

export interface RealtimeCostData {
  lastHourTTS: number;
  lastHourSTT: number;
  lastHourAI: number;
  lastHourTotal: number;
  ttsPercentage: number;
  sttPercentage: number;
  aiPercentage: number;
  costPerMinute: number;
  minuteTrend: MinuteTrend[];
  recentCosts: ApiCostEntry[];
  alertLevel: 'normal' | 'warning' | 'critical';
  alertMessage: string;
  isLive: boolean;
  lastUpdated: Date;
  isLoading: boolean;
  error: string | null;
}

const ALERT_THRESHOLDS = {
  tts: {
    critical: { hourly: 2.0, percentage: 30 },
    warning: { hourly: 0.5, percentage: 10 },
  },
};

function classifyServiceType(serviceType: string): 'tts' | 'stt' | 'ai' {
  if (serviceType.startsWith('tts_')) return 'tts';
  if (serviceType.startsWith('stt_') || serviceType === 'stt_transcription') return 'stt';
  return 'ai';
}

function calculateAlertLevel(
  ttsSpend: number,
  totalSpend: number
): { level: 'normal' | 'warning' | 'critical'; message: string } {
  const ttsPercentage = totalSpend > 0 ? (ttsSpend / totalSpend) * 100 : 0;

  // Critical: TTS > $2/hr OR > 30% of total
  if (ttsSpend > ALERT_THRESHOLDS.tts.critical.hourly) {
    return {
      level: 'critical',
      message: `🚨 TTS spend exceeds $${ALERT_THRESHOLDS.tts.critical.hourly}/hour ($${ttsSpend.toFixed(2)}/hr). Check for runaway audio generation!`,
    };
  }
  if (ttsPercentage > ALERT_THRESHOLDS.tts.critical.percentage) {
    return {
      level: 'critical',
      message: `🚨 TTS is ${ttsPercentage.toFixed(1)}% of total spend (should be near 0% when disabled). Investigate immediately!`,
    };
  }

  // Warning: TTS > $0.50/hr OR > 10% of total
  if (ttsSpend > ALERT_THRESHOLDS.tts.warning.hourly) {
    return {
      level: 'warning',
      message: `⚠️ TTS spend is elevated at $${ttsSpend.toFixed(2)}/hour. Monitor for unexpected audio generation.`,
    };
  }
  if (ttsPercentage > ALERT_THRESHOLDS.tts.warning.percentage) {
    return {
      level: 'warning',
      message: `⚠️ TTS is ${ttsPercentage.toFixed(1)}% of total spend. Expected near 0% when TTS is disabled.`,
    };
  }

  return { level: 'normal', message: '' };
}

export function useRealtimeCostMonitor() {
  const [data, setData] = useState<RealtimeCostData>({
    lastHourTTS: 0,
    lastHourSTT: 0,
    lastHourAI: 0,
    lastHourTotal: 0,
    ttsPercentage: 0,
    sttPercentage: 0,
    aiPercentage: 0,
    costPerMinute: 0,
    minuteTrend: [],
    recentCosts: [],
    alertLevel: 'normal',
    alertMessage: '',
    isLive: false,
    lastUpdated: new Date(),
    isLoading: true,
    error: null,
  });

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchCosts = useCallback(async () => {
    try {
      const sixtyMinutesAgo = subMinutes(new Date(), 60).toISOString();

      const { data: costs, error } = await supabase
        .from('api_costs')
        .select('id, created_at, service_type, service_provider, estimated_cost_usd, edge_function')
        .gte('created_at', sixtyMinutesAgo)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Aggregate by minute
      const minuteMap = new Map<string, { tts: number; stt: number; ai: number }>();
      let totalTTS = 0;
      let totalSTT = 0;
      let totalAI = 0;

      (costs || []).forEach((cost) => {
        const minute = format(new Date(cost.created_at), 'HH:mm');
        const category = classifyServiceType(cost.service_type);
        const amount = cost.estimated_cost_usd || 0;

        if (!minuteMap.has(minute)) {
          minuteMap.set(minute, { tts: 0, stt: 0, ai: 0 });
        }
        const entry = minuteMap.get(minute)!;
        entry[category] += amount;

        if (category === 'tts') totalTTS += amount;
        else if (category === 'stt') totalSTT += amount;
        else totalAI += amount;
      });

      // Convert to array and sort by time
      const minuteTrend: MinuteTrend[] = Array.from(minuteMap.entries())
        .map(([minute, values]) => ({
          minute,
          ...values,
          total: values.tts + values.stt + values.ai,
        }))
        .sort((a, b) => a.minute.localeCompare(b.minute));

      const total = totalTTS + totalSTT + totalAI;
      const { level, message } = calculateAlertLevel(totalTTS, total);

      setData({
        lastHourTTS: totalTTS,
        lastHourSTT: totalSTT,
        lastHourAI: totalAI,
        lastHourTotal: total,
        ttsPercentage: total > 0 ? (totalTTS / total) * 100 : 0,
        sttPercentage: total > 0 ? (totalSTT / total) * 100 : 0,
        aiPercentage: total > 0 ? (totalAI / total) * 100 : 0,
        costPerMinute: total / 60,
        minuteTrend,
        recentCosts: (costs || []).slice(0, 10),
        alertLevel: level,
        alertMessage: message,
        isLive: true,
        lastUpdated: new Date(),
        isLoading: false,
        error: null,
      });
    } catch (err) {
      console.error('Error fetching realtime costs:', err);
      setData((prev) => ({
        ...prev,
        isLoading: false,
        isLive: false,
        error: err instanceof Error ? err.message : 'Failed to fetch costs',
      }));
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchCosts();

    // Setup polling every 60 seconds (reduced from 30s to lower compute costs)
    const pollInterval = setInterval(fetchCosts, 60000);

    // Setup realtime subscription
    channelRef.current = supabase
      .channel('api_costs_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'api_costs',
        },
        (payload) => {
          console.log('New cost entry:', payload.new);
          // Refetch to update aggregations
          fetchCosts();
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
        if (status === 'SUBSCRIBED') {
          setData((prev) => ({ ...prev, isLive: true }));
        }
      });

    return () => {
      clearInterval(pollInterval);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [fetchCosts]);

  return data;
}
