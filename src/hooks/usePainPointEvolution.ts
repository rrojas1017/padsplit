import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths } from 'date-fns';

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

export type TimeRangeOption = '3m' | '6m' | '12m' | 'all';

export interface EvolutionMeta {
  actualStartMonth: string | null;
  actualEndMonth: string | null;
  monthCount: number;
}

interface UsePainPointEvolutionResult {
  chartData: ChartDataPoint[];
  categories: string[];
  statuses: PainPointStatus[];
  statusSummary: StatusSummary;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  meta: EvolutionMeta;
}

// Stop words to filter out when extracting keywords
const STOP_WORDS = new Set([
  'and', 'or', 'the', 'a', 'an', 'of', 'for', 'to', 'with', 'in', 'on', '&',
  'about', 'around', 'at', 'by', 'from', 'into', 'over', 'than', 'that', 'this',
  'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can',
  'not', 'no', 'nor', 'but', 'if', 'then', 'else', 'when', 'where', 'why', 'how',
  'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
  'only', 'own', 'same', 'so', 'too', 'very', 'just', 'also', 'even', 'still'
]);

const SIMILARITY_THRESHOLD = 0.5;

function extractKeywords(category: string): Set<string> {
  return new Set(
    category.toLowerCase()
      .replace(/[&\/\\-]/g, ' ')
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2 && !STOP_WORDS.has(word))
  );
}

function calculateSimilarity(set1: Set<string>, set2: Set<string>): number {
  if (set1.size === 0 || set2.size === 0) return 0;
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

function findCanonicalCategory(
  newCategory: string,
  existingCategories: Map<string, { display: string; keywords: Set<string> }>
): string | null {
  const newKeywords = extractKeywords(newCategory);
  for (const [normalized, data] of existingCategories) {
    if (calculateSimilarity(newKeywords, data.keywords) >= SIMILARITY_THRESHOLD) {
      return normalized;
    }
  }
  return null;
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
  if (current === null && previous !== null) return 'resolved';
  if (current !== null && occurrenceCount <= Math.max(1, totalMonths * 0.3)) return 'emerging';
  if (previous === null || current === null) return 'stable';
  const delta = current - previous;
  if (delta > 5) return 'rising';
  if (delta < -5) return 'falling';
  return 'stable';
}

/**
 * Deduplicate analyses per month: keep only the latest one (by created_at) per month.
 */
function deduplicatePerMonth(analyses: any[]): any[] {
  const monthMap = new Map<string, any>();
  for (const a of analyses) {
    const monthKey = format(new Date(a.date_range_end), 'yyyy-MM');
    const existing = monthMap.get(monthKey);
    if (!existing || new Date(a.created_at) > new Date(existing.created_at)) {
      monthMap.set(monthKey, a);
    }
  }
  return Array.from(monthMap.values());
}

export function usePainPointEvolution(timeRange: TimeRangeOption = '6m'): UsePainPointEvolutionResult {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<PainPointStatus[]>([]);
  const [statusSummary, setStatusSummary] = useState<StatusSummary>({
    rising: 0, falling: 0, stable: 0, emerging: 0, resolved: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [meta, setMeta] = useState<EvolutionMeta>({ actualStartMonth: null, actualEndMonth: null, monthCount: 0 });

  const fetchEvolutionData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const now = new Date();
      let cutoffDate: Date | null = null;
      switch (timeRange) {
        case '3m': cutoffDate = subMonths(now, 3); break;
        case '6m': cutoffDate = subMonths(now, 6); break;
        case '12m': cutoffDate = subMonths(now, 12); break;
        case 'all': cutoffDate = null; break;
      }

      // Step 1: Try allTime analyses first
      let query = supabase
        .from('member_insights')
        .select('id, created_at, date_range_start, date_range_end, pain_points, status, analysis_period')
        .eq('status', 'completed')
        .eq('analysis_period', 'allTime')
        .order('date_range_end', { ascending: true });

      if (cutoffDate) {
        query = query.gte('date_range_end', cutoffDate.toISOString());
      }

      let { data: analyses, error: fetchError } = await query.limit(100);
      if (fetchError) throw fetchError;

      // Step 2: Fallback to include 'manual' if fewer than 2 allTime analyses
      if (!analyses || analyses.length < 2) {
        let fallbackQuery = supabase
          .from('member_insights')
          .select('id, created_at, date_range_start, date_range_end, pain_points, status, analysis_period')
          .eq('status', 'completed')
          .in('analysis_period', ['allTime', 'manual'])
          .order('date_range_end', { ascending: true });

        if (cutoffDate) {
          fallbackQuery = fallbackQuery.gte('date_range_end', cutoffDate.toISOString());
        }

        const { data: fallbackData, error: fallbackError } = await fallbackQuery.limit(100);
        if (fallbackError) throw fallbackError;
        analyses = fallbackData;
      }

      if (!analyses || analyses.length === 0) {
        setChartData([]);
        setCategories([]);
        setStatuses([]);
        setMeta({ actualStartMonth: null, actualEndMonth: null, monthCount: 0 });
        setIsLoading(false);
        return;
      }

      // Step 3: Deduplicate — keep only the latest analysis per month
      const dedupedAnalyses = deduplicatePerMonth(analyses);

      // Group by month and process pain points
      const monthlyBuckets = new Map<string, MonthlyBucket>();
      const canonicalCategories = new Map<string, {
        normalized: string;
        display: string;
        keywords: Set<string>;
        firstSeen: string;
        lastSeen: string;
        occurrenceCount: number;
        monthlyFrequencies: Map<string, number[]>;
      }>();
      const categoryMapping = new Map<string, string>();

      for (const analysis of dedupedAnalyses) {
        const endDate = new Date(analysis.date_range_end);
        const monthKey = format(endDate, 'yyyy-MM');
        const monthLabel = format(endDate, 'MMM yyyy');

        if (!monthlyBuckets.has(monthKey)) {
          monthlyBuckets.set(monthKey, { monthKey, monthLabel, painPoints: new Map() });
        }

        const bucket = monthlyBuckets.get(monthKey)!;
        const painPoints = (Array.isArray(analysis.pain_points) ? analysis.pain_points : []) as unknown as PainPointData[];

        for (const pp of painPoints) {
          if (!pp.category) continue;
          const rawCategory = pp.category;
          const frequency = pp.frequency ?? pp.frequency_percent ?? 0;
          let canonicalKey: string;

          if (categoryMapping.has(rawCategory)) {
            canonicalKey = categoryMapping.get(rawCategory)!;
          } else {
            const matchedKey = findCanonicalCategory(rawCategory, canonicalCategories);
            if (matchedKey) {
              canonicalKey = matchedKey;
            } else {
              canonicalKey = normalizeCategory(rawCategory);
              canonicalCategories.set(canonicalKey, {
                normalized: canonicalKey,
                display: rawCategory,
                keywords: extractKeywords(rawCategory),
                firstSeen: monthLabel,
                lastSeen: monthLabel,
                occurrenceCount: 0,
                monthlyFrequencies: new Map()
              });
            }
            categoryMapping.set(rawCategory, canonicalKey);
          }

          const catData = canonicalCategories.get(canonicalKey)!;
          catData.lastSeen = monthLabel;
          catData.occurrenceCount++;

          if (!catData.monthlyFrequencies.has(monthKey)) {
            catData.monthlyFrequencies.set(monthKey, []);
          }
          catData.monthlyFrequencies.get(monthKey)!.push(frequency);

          if (!bucket.painPoints.has(canonicalKey)) {
            bucket.painPoints.set(canonicalKey, []);
          }
          bucket.painPoints.get(canonicalKey)!.push(frequency);
        }
      }

      const sortedMonths = Array.from(monthlyBuckets.values())
        .sort((a, b) => a.monthKey.localeCompare(b.monthKey));

      // Build meta
      const actualStartMonth = sortedMonths.length > 0 ? sortedMonths[0].monthLabel : null;
      const actualEndMonth = sortedMonths.length > 0 ? sortedMonths[sortedMonths.length - 1].monthLabel : null;

      setMeta({
        actualStartMonth,
        actualEndMonth,
        monthCount: sortedMonths.length
      });

      // Top 5 categories by avg frequency
      const sortedCategories = Array.from(canonicalCategories.values())
        .map(cat => {
          const allFreqs: number[] = [];
          for (const freqs of cat.monthlyFrequencies.values()) allFreqs.push(...freqs);
          const avgFreq = allFreqs.length > 0 ? allFreqs.reduce((s, f) => s + f, 0) / allFreqs.length : 0;
          return { ...cat, avgFreq };
        })
        .sort((a, b) => b.avgFreq - a.avgFreq)
        .slice(0, 5);

      const topCategoryNames = sortedCategories.map(c => c.normalized);

      const chartDataPoints: ChartDataPoint[] = sortedMonths.map(bucket => {
        const dataPoint: ChartDataPoint = { date: bucket.monthLabel };
        for (const catName of topCategoryNames) {
          const frequencies = bucket.painPoints.get(catName);
          if (frequencies && frequencies.length > 0) {
            dataPoint[catName] = Math.round(frequencies.reduce((s, f) => s + f, 0) / frequencies.length);
          } else {
            dataPoint[catName] = 0;
          }
        }
        return dataPoint;
      });

      // Calculate statuses
      const totalMonths = sortedMonths.length;
      const latestMonth = sortedMonths[sortedMonths.length - 1];
      const previousMonth = sortedMonths.length > 1 ? sortedMonths[sortedMonths.length - 2] : null;

      const statusList: PainPointStatus[] = [];
      for (const catData of canonicalCategories.values()) {
        const currentFreqs = latestMonth?.painPoints.get(catData.normalized);
        const previousFreqs = previousMonth?.painPoints.get(catData.normalized);
        const current = currentFreqs?.length ? currentFreqs.reduce((s, f) => s + f, 0) / currentFreqs.length : null;
        const previous = previousFreqs?.length ? previousFreqs.reduce((s, f) => s + f, 0) / previousFreqs.length : null;
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
      }

      statusList.sort((a, b) => {
        if (a.currentFrequency === null && b.currentFrequency !== null) return 1;
        if (a.currentFrequency !== null && b.currentFrequency === null) return -1;
        return (b.currentFrequency ?? 0) - (a.currentFrequency ?? 0);
      });

      const limitedStatusList = statusList.slice(0, 15);
      const limitedSummary: StatusSummary = { rising: 0, falling: 0, stable: 0, emerging: 0, resolved: 0 };
      for (const status of limitedStatusList) limitedSummary[status.trend]++;

      setChartData(chartDataPoints);
      setCategories(sortedCategories.map(c => c.display));
      setStatuses(limitedStatusList);
      setStatusSummary(limitedSummary);
    } catch (err) {
      console.error('Error fetching pain point evolution:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchEvolutionData();
  }, [fetchEvolutionData]);

  return { chartData, categories, statuses, statusSummary, isLoading, error, refetch: fetchEvolutionData, meta };
}
