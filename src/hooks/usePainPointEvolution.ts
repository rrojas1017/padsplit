import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface PainPointData {
  category: string;
  frequency: number;
  frequency_percent?: number;
  quote?: string;
}

interface MonthlyBucket {
  monthKey: string;
  monthLabel: string;
  painPoints: Map<string, number[]>;
}

export interface PainPointStatus {
  category: string;
  currentFrequency: number | null;
  previousFrequency: number | null;
  trend: 'rising' | 'falling' | 'stable' | 'emerging' | 'resolved';
  trendDelta: number;
  firstSeen: string;
  lastSeen: string;
  occurrenceCount: number;
}

interface StatusSummary {
  rising: number;
  falling: number;
  stable: number;
  emerging: number;
  resolved: number;
}

interface ChartDataPoint {
  date: string;
  [category: string]: string | number;
}

interface UsePainPointEvolutionResult {
  chartData: ChartDataPoint[];
  categories: string[];
  statuses: PainPointStatus[];
  statusSummary: StatusSummary;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

function normalizeCategory(category: string): string {
  return category.toLowerCase().trim().replace(/\s+/g, ' ');
}

function getTrendStatus(
  current: number | null,
  previous: number | null,
  occurrenceCount: number,
  totalMonths: number
): 'rising' | 'falling' | 'stable' | 'emerging' | 'resolved' {
  if (current === null && previous !== null) {
    return 'resolved';
  }
  
  if (current !== null && occurrenceCount <= Math.max(1, totalMonths * 0.3)) {
    return 'emerging';
  }
  
  if (previous === null || current === null) {
    return 'stable';
  }
  
  const delta = current - previous;
  
  if (delta > 5) return 'rising';
  if (delta < -5) return 'falling';
  return 'stable';
}

export function usePainPointEvolution(): UsePainPointEvolutionResult {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<PainPointStatus[]>([]);
  const [statusSummary, setStatusSummary] = useState<StatusSummary>({
    rising: 0,
    falling: 0,
    stable: 0,
    emerging: 0,
    resolved: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchEvolutionData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch all completed analyses to cover multiple months
      const { data: analyses, error: fetchError } = await supabase
        .from('member_insights')
        .select('id, created_at, date_range_start, date_range_end, pain_points, status')
        .eq('status', 'completed')
        .order('date_range_end', { ascending: true })
        .limit(100);

      if (fetchError) throw fetchError;

      if (!analyses || analyses.length === 0) {
        setChartData([]);
        setCategories([]);
        setStatuses([]);
        setIsLoading(false);
        return;
      }

      // Group analyses by month using date_range_end
      const monthlyBuckets = new Map<string, MonthlyBucket>();
      const allCategories = new Map<string, {
        normalized: string;
        display: string;
        firstSeen: string;
        lastSeen: string;
        occurrenceCount: number;
        monthlyFrequencies: Map<string, number>;
      }>();

      for (const analysis of analyses) {
        const endDate = new Date(analysis.date_range_end);
        const monthKey = format(endDate, 'yyyy-MM');
        const monthLabel = format(endDate, 'MMM yyyy');
        
        if (!monthlyBuckets.has(monthKey)) {
          monthlyBuckets.set(monthKey, {
            monthKey,
            monthLabel,
            painPoints: new Map()
          });
        }
        
        const bucket = monthlyBuckets.get(monthKey)!;
        const painPoints = (Array.isArray(analysis.pain_points) ? analysis.pain_points : []) as unknown as PainPointData[];
        
        for (const pp of painPoints) {
          if (!pp.category) continue;
          
          const normalized = normalizeCategory(pp.category);
          const frequency = pp.frequency ?? pp.frequency_percent ?? 0;
          
          // Add to monthly bucket
          if (!bucket.painPoints.has(normalized)) {
            bucket.painPoints.set(normalized, []);
          }
          bucket.painPoints.get(normalized)!.push(frequency);
          
          // Track category metadata
          if (!allCategories.has(normalized)) {
            allCategories.set(normalized, {
              normalized,
              display: pp.category,
              firstSeen: monthLabel,
              lastSeen: monthLabel,
              occurrenceCount: 1,
              monthlyFrequencies: new Map()
            });
          } else {
            const existing = allCategories.get(normalized)!;
            existing.lastSeen = monthLabel;
            existing.occurrenceCount++;
          }
        }
      }

      // Calculate average frequency per category per month
      const sortedMonths = Array.from(monthlyBuckets.values())
        .sort((a, b) => a.monthKey.localeCompare(b.monthKey));

      // Build monthly averages for each category
      for (const bucket of sortedMonths) {
        for (const [normalized, frequencies] of bucket.painPoints.entries()) {
          const avgFrequency = frequencies.reduce((sum, f) => sum + f, 0) / frequencies.length;
          const catData = allCategories.get(normalized);
          if (catData) {
            catData.monthlyFrequencies.set(bucket.monthKey, avgFrequency);
          }
        }
      }

      // Get top 5 categories by average frequency across all months
      const sortedCategories = Array.from(allCategories.values())
        .map(cat => {
          const allFreqs = Array.from(cat.monthlyFrequencies.values());
          const avgFreq = allFreqs.length > 0 
            ? allFreqs.reduce((sum, f) => sum + f, 0) / allFreqs.length 
            : 0;
          return { ...cat, avgFreq };
        })
        .sort((a, b) => b.avgFreq - a.avgFreq)
        .slice(0, 5);

      const topCategoryNames = sortedCategories.map(c => c.normalized);

      // Build chart data with monthly aggregation
      const chartDataPoints: ChartDataPoint[] = sortedMonths.map(bucket => {
        const dataPoint: ChartDataPoint = { date: bucket.monthLabel };
        
        for (const catName of topCategoryNames) {
          const frequencies = bucket.painPoints.get(catName);
          if (frequencies && frequencies.length > 0) {
            dataPoint[catName] = Math.round(
              frequencies.reduce((sum, f) => sum + f, 0) / frequencies.length
            );
          } else {
            dataPoint[catName] = 0;
          }
        }
        return dataPoint;
      });

      // Calculate statuses comparing current month to previous month
      const totalMonths = sortedMonths.length;
      const latestMonth = sortedMonths[sortedMonths.length - 1];
      const previousMonth = sortedMonths.length > 1 ? sortedMonths[sortedMonths.length - 2] : null;

      const statusList: PainPointStatus[] = [];
      const summary: StatusSummary = { rising: 0, falling: 0, stable: 0, emerging: 0, resolved: 0 };

      for (const catData of allCategories.values()) {
        const currentFreqs = latestMonth?.painPoints.get(catData.normalized);
        const previousFreqs = previousMonth?.painPoints.get(catData.normalized);
        
        const current = currentFreqs && currentFreqs.length > 0
          ? currentFreqs.reduce((sum, f) => sum + f, 0) / currentFreqs.length
          : null;
        const previous = previousFreqs && previousFreqs.length > 0
          ? previousFreqs.reduce((sum, f) => sum + f, 0) / previousFreqs.length
          : null;
        
        const trend = getTrendStatus(current, previous, catData.occurrenceCount, totalMonths);
        const trendDelta = current !== null && previous !== null ? current - previous : 0;
        
        statusList.push({
          category: catData.display,
          currentFrequency: current !== null ? Math.round(current) : null,
          previousFrequency: previous !== null ? Math.round(previous) : null,
          trend,
          trendDelta,
          firstSeen: catData.firstSeen,
          lastSeen: catData.lastSeen,
          occurrenceCount: catData.occurrenceCount
        });
        
        summary[trend]++;
      }

      // Sort statuses: current issues first (by frequency desc), then resolved
      statusList.sort((a, b) => {
        if (a.currentFrequency === null && b.currentFrequency !== null) return 1;
        if (a.currentFrequency !== null && b.currentFrequency === null) return -1;
        return (b.currentFrequency ?? 0) - (a.currentFrequency ?? 0);
      });

      setChartData(chartDataPoints);
      setCategories(sortedCategories.map(c => c.display));
      setStatuses(statusList);
      setStatusSummary(summary);
    } catch (err) {
      console.error('Error fetching pain point evolution:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvolutionData();
  }, [fetchEvolutionData]);

  return {
    chartData,
    categories,
    statuses,
    statusSummary,
    isLoading,
    error,
    refetch: fetchEvolutionData
  };
}
