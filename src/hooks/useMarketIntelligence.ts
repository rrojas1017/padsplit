import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MarketStateData {
  state: string;
  total: number;
  bookings: number;
  nonBookings: number;
  movedIn: number;
  pendingMoveIn: number;
  rejected: number;
  noShow: number;
  cancelled: number;
  postponed: number;
  conversionRate: number;
  churnRate: number;
  avgCallDuration: number;
  dominantSentiment: string;
  sentimentBreakdown: { positive: number; negative: number; neutral: number; mixed: number };
  avgBuyerIntent: number | null;
  avgWeeklyBudget: number | null;
  topObjections: { label: string; count: number }[];
}

export interface MarketCityData extends MarketStateData {
  city: string;
}

export function useMarketIntelligence(dateFrom?: string, dateTo?: string, minRecords = 1) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['market-intelligence', dateFrom, dateTo, minRecords],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('aggregate-market-data', {
        body: { dateFrom, dateTo, minRecords },
      });

      if (response.error) throw new Error(response.error.message);
      return response.data as {
        stateData: MarketStateData[];
        cityData: MarketCityData[];
        generatedAt: string;
        fromCache: boolean;
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const refresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  // Compute top markets (by volume)
  const topMarkets = (data?.cityData || [])
    .filter(c => c.city !== 'Unknown')
    .slice(0, 10);

  // System-wide average conversion rate
  const systemAvgConversion = (() => {
    const states = data?.stateData || [];
    const totalBookings = states.reduce((s, st) => s + st.bookings, 0);
    const totalMovedIn = states.reduce((s, st) => s + st.movedIn, 0);
    return totalBookings > 0 ? Math.round((totalMovedIn / totalBookings) * 1000) / 10 : 0;
  })();

  // System-wide average weekly budget
  const systemAvgBudget = (() => {
    const states = data?.stateData || [];
    const withBudget = states.filter(s => s.avgWeeklyBudget !== null);
    if (withBudget.length === 0) return null;
    const sum = withBudget.reduce((s, st) => s + (st.avgWeeklyBudget ?? 0), 0);
    return Math.round(sum / withBudget.length);
  })();

  return {
    stateData: data?.stateData || [],
    cityData: data?.cityData || [],
    topMarkets,
    systemAvgConversion,
    systemAvgBudget,
    generatedAt: data?.generatedAt,
    fromCache: data?.fromCache || false,
    isLoading,
    isRefreshing,
    error,
    refresh,
  };
}
