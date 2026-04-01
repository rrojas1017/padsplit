import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TrendPoint {
  date: string;
  totalCases: number;
  addressablePct: string;
  hostRelatedPct: string;
  paymentRelatedPct: string;
}

export interface TrendDirection {
  totalCases: 'up' | 'down' | 'stable';
  totalCasesDelta: number;
}

export function useResearchTrends(limit = 8) {
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [direction, setDirection] = useState<TrendDirection | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTrends = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('research_insights')
        .select('id, created_at, data')
        .eq('campaign_type', 'move_out_survey')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      const points: TrendPoint[] = (data || []).map((r: any) => {
        const es = r.data?.executive_summary || {};
        return {
          date: r.created_at,
          totalCases: es.total_cases || 0,
          addressablePct: es.addressable_pct?.toString() || 'N/A',
          hostRelatedPct: es.host_related_pct?.toString() || 'N/A',
          paymentRelatedPct: es.payment_related_pct?.toString() || 'N/A',
        };
      });

      setTrends(points);

      // Compute direction from last 2 reports
      if (points.length >= 2) {
        const current = points[0].totalCases;
        const previous = points[1].totalCases;
        const delta = current - previous;
        setDirection({
          totalCases: delta > 0 ? 'up' : delta < 0 ? 'down' : 'stable',
          totalCasesDelta: delta,
        });
      }
    } catch (err) {
      console.error('Error fetching research trends:', err);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  return { trends, direction, isLoading };
}
