import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths } from 'date-fns';

export type TimeRangeOption = '3m' | '6m' | '12m' | 'all';

interface SentimentDataPoint {
  date: string;
  fullDate: string;
  dateRange: string;
  calls: number;
  positive: number;
  neutral: number;
  negative: number;
}

interface UseSentimentTrendsResult {
  chartData: SentimentDataPoint[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useSentimentTrends(timeRange: TimeRangeOption = '6m'): UseSentimentTrendsResult {
  const [chartData, setChartData] = useState<SentimentDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const getCutoffDate = useCallback((range: TimeRangeOption): Date | null => {
    const now = new Date();
    switch (range) {
      case '3m':
        return subMonths(now, 3);
      case '6m':
        return subMonths(now, 6);
      case '12m':
        return subMonths(now, 12);
      case 'all':
        return null;
    }
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const cutoffDate = getCutoffDate(timeRange);

      let query = supabase
        .from('member_insights')
        .select('id, created_at, date_range_start, date_range_end, total_calls_analyzed, sentiment_distribution, status')
        .eq('status', 'completed')
        .order('date_range_end', { ascending: true });

      if (cutoffDate) {
        query = query.gte('date_range_end', cutoffDate.toISOString());
      }

      const { data, error: queryError } = await query.limit(50);

      if (queryError) throw queryError;

      if (!data || data.length === 0) {
        setChartData([]);
        return;
      }

      // Count occurrences of each date to detect duplicates
      const dateCounts: Record<string, number> = {};
      data.forEach((insight) => {
        const dateKey = format(new Date(insight.created_at), 'MMM d');
        dateCounts[dateKey] = (dateCounts[dateKey] || 0) + 1;
      });

      // Process data into chart format
      const processedData: SentimentDataPoint[] = data.map((insight) => {
        const dateKey = format(new Date(insight.created_at), 'MMM d');
        const needsTime = dateCounts[dateKey] > 1;

        // Format date range for tooltip
        let dateRangeText = '';
        if (insight.date_range_start && insight.date_range_end) {
          const start = format(new Date(insight.date_range_start), 'MMM d');
          const end = format(new Date(insight.date_range_end), 'MMM d');
          dateRangeText = `${start} - ${end}`;
        }

        const sentiment = (insight.sentiment_distribution as { positive?: number; neutral?: number; negative?: number }) || {};

        return {
          date: needsTime
            ? format(new Date(insight.created_at), 'MMM d ha')
            : dateKey,
          fullDate: format(new Date(insight.created_at), 'MMM d, yyyy h:mm a'),
          dateRange: dateRangeText,
          calls: insight.total_calls_analyzed || 0,
          positive: sentiment.positive || 0,
          neutral: sentiment.neutral || 0,
          negative: sentiment.negative || 0,
        };
      });

      setChartData(processedData);
    } catch (err) {
      console.error('Error fetching sentiment trends:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch sentiment trends'));
    } finally {
      setIsLoading(false);
    }
  }, [timeRange, getCutoffDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    chartData,
    isLoading,
    error,
    refetch: fetchData,
  };
}
