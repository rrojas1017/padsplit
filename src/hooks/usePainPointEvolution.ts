import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PainPointData {
  category: string;
  frequency_percent: number;
  quote?: string;
}

interface EvolutionDataPoint {
  date: string;
  analysisId: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  painPoints: Record<string, number>; // category -> frequency
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
  totalAnalyses: number
): 'rising' | 'falling' | 'stable' | 'emerging' | 'resolved' {
  // Resolved: was present before but not in current
  if (current === null && previous !== null) {
    return 'resolved';
  }
  
  // Emerging: new in recent analyses (seen in less than 30% of analyses)
  if (current !== null && occurrenceCount <= Math.max(1, totalAnalyses * 0.3)) {
    return 'emerging';
  }
  
  // No previous to compare
  if (previous === null || current === null) {
    return 'stable';
  }
  
  const delta = current - previous;
  
  if (delta > 5) return 'rising';
  if (delta < -5) return 'falling';
  return 'stable';
}

export function usePainPointEvolution(limit: number = 10): UsePainPointEvolutionResult {
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
      // Fetch last N completed analyses with pain points
      const { data: analyses, error: fetchError } = await supabase
        .from('member_insights')
        .select('id, created_at, date_range_start, date_range_end, pain_points, status')
        .eq('status', 'completed')
        .order('created_at', { ascending: true })
        .limit(limit);

      if (fetchError) throw fetchError;

      if (!analyses || analyses.length === 0) {
        setChartData([]);
        setCategories([]);
        setStatuses([]);
        setIsLoading(false);
        return;
      }

      // Build evolution data points
      const evolutionPoints: EvolutionDataPoint[] = [];
      const allCategories = new Map<string, {
        normalized: string;
        display: string;
        firstSeen: string;
        lastSeen: string;
        occurrenceCount: number;
        frequencyHistory: { date: string; frequency: number }[];
      }>();

      for (const analysis of analyses) {
        const painPoints = (Array.isArray(analysis.pain_points) ? analysis.pain_points : []) as unknown as PainPointData[];
        const date = new Date(analysis.created_at).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        });
        
        const pointData: Record<string, number> = {};
        
        for (const pp of painPoints) {
          if (!pp.category) continue;
          
          const normalized = normalizeCategory(pp.category);
          const frequency = pp.frequency_percent || 0;
          pointData[normalized] = frequency;
          
          if (!allCategories.has(normalized)) {
            allCategories.set(normalized, {
              normalized,
              display: pp.category,
              firstSeen: date,
              lastSeen: date,
              occurrenceCount: 1,
              frequencyHistory: [{ date, frequency }]
            });
          } else {
            const existing = allCategories.get(normalized)!;
            existing.lastSeen = date;
            existing.occurrenceCount++;
            existing.frequencyHistory.push({ date, frequency });
          }
        }
        
        evolutionPoints.push({
          date,
          analysisId: analysis.id,
          dateRangeStart: analysis.date_range_start,
          dateRangeEnd: analysis.date_range_end,
          painPoints: pointData
        });
      }

      // Get top 5 categories by total occurrences and average frequency
      const sortedCategories = Array.from(allCategories.values())
        .sort((a, b) => {
          const avgA = a.frequencyHistory.reduce((sum, h) => sum + h.frequency, 0) / a.frequencyHistory.length;
          const avgB = b.frequencyHistory.reduce((sum, h) => sum + h.frequency, 0) / b.frequencyHistory.length;
          return avgB - avgA;
        })
        .slice(0, 5);

      const topCategoryNames = sortedCategories.map(c => c.normalized);

      // Build chart data
      const chartDataPoints: ChartDataPoint[] = evolutionPoints.map(point => {
        const dataPoint: ChartDataPoint = { date: point.date };
        for (const catName of topCategoryNames) {
          dataPoint[catName] = point.painPoints[catName] ?? 0;
        }
        return dataPoint;
      });

      // Calculate statuses for all categories
      const latestPoint = evolutionPoints[evolutionPoints.length - 1];
      const previousPoint = evolutionPoints.length > 1 ? evolutionPoints[evolutionPoints.length - 2] : null;

      const statusList: PainPointStatus[] = [];
      const summary: StatusSummary = { rising: 0, falling: 0, stable: 0, emerging: 0, resolved: 0 };

      // Process current pain points
      for (const [normalized, catData] of allCategories.entries()) {
        const current = latestPoint.painPoints[normalized] ?? null;
        const previous = previousPoint ? (previousPoint.painPoints[normalized] ?? null) : null;
        
        const trend = getTrendStatus(current, previous, catData.occurrenceCount, analyses.length);
        const trendDelta = current !== null && previous !== null ? current - previous : 0;
        
        statusList.push({
          category: catData.display,
          currentFrequency: current,
          previousFrequency: previous,
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
  }, [limit]);

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
