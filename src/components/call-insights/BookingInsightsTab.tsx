import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { deduplicatedQuery } from '@/utils/databaseCircuitBreaker';
import { useMemberInsightsPolling } from '@/hooks/useMemberInsightsPolling';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, RefreshCw, Loader2, Download, Sparkles, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfDay } from 'date-fns';
import { generateMemberInsightsPDF } from '@/utils/memberInsightsPDF';
import InsightsSummaryCards from '@/components/member-insights/InsightsSummaryCards';
import PainPointsPanel from '@/components/member-insights/PainPointsPanel';
import ObjectionsChart from '@/components/member-insights/ObjectionsChart';
import MarketInsights from '@/components/member-insights/MarketInsights';
import RecommendationsPanel from '@/components/member-insights/RecommendationsPanel';
import SentimentChart from '@/components/member-insights/SentimentChart';
import TrendChart from '@/components/member-insights/TrendChart';
import CustomerJourneyPanel from '@/components/member-insights/CustomerJourneyPanel';
import { PainPointEvolutionPanel } from '@/components/member-insights/PainPointEvolutionPanel';

interface CustomerJourney {
  persona_name: string;
  frequency_percent: number;
  trigger_quote: string;
  journey_stages: Array<{
    stage: string;
    emotion: string;
    action?: string;
    friction?: string;
    outcome?: string;
  }>;
  intervention_points: string[];
  example_quotes: string[];
  related_pain_points: string[];
  market_concentration?: Record<string, number>;
}

interface MemberInsight {
  id: string;
  analysis_period: string;
  date_range_start: string;
  date_range_end: string;
  total_calls_analyzed: number;
  pain_points: any[];
  payment_insights: any[];
  transportation_insights: any[];
  price_sensitivity: any[];
  move_in_barriers: any[];
  property_preferences: any[];
  objection_patterns: any[];
  market_breakdown: Record<string, any>;
  sentiment_distribution: { positive: number; neutral: number; negative: number };
  ai_recommendations: any[];
  member_journey_insights: any[];
  customer_journeys?: CustomerJourney[];
  avg_call_duration_seconds?: number;
  created_at: string;
  status?: 'processing' | 'completed' | 'failed';
  error_message?: string;
  // New fields for trends
  trend_comparison?: {
    previous_insight_id?: string;
    previous_date_range?: string;
    previous_total_calls?: number;
    current_total_calls?: number;
  } | null;
  emerging_issues?: string[];
  source_booking_ids?: Record<string, string[]>;
}

type DateRangeOption = 'thisWeek' | 'lastMonth' | 'thisMonth' | 'last3months' | 'allTime';

interface BookingInsightsTabProps {
  dateRange: DateRangeOption;
  onDateRangeChange: (range: DateRangeOption) => void;
}

export function BookingInsightsTab({ dateRange, onDateRangeChange }: BookingInsightsTabProps) {
  const { user } = useAuth();
  const [insights, setInsights] = useState<MemberInsight[]>([]);
  const [selectedInsight, setSelectedInsight] = useState<MemberInsight | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Get period filter values (include 'manual' for backward compatibility)
  const getPeriodFilters = useCallback((period: DateRangeOption): string[] => {
    if (period === 'allTime') {
      return ['allTime', 'manual']; // Treat old 'manual' entries as 'allTime'
    }
    return [period];
  }, []);

  // Memoized fetch function to prevent stale closures
  const fetchInsights = useCallback(async () => {
    try {
      const periodFilters = getPeriodFilters(dateRange);
      
      const result = await deduplicatedQuery(`member_insights_list_${dateRange}`, async () => {
        return await supabase
          .from('member_insights')
          .select('id, analysis_period, date_range_start, date_range_end, total_calls_analyzed, created_at, status, sentiment_distribution')
          .in('analysis_period', periodFilters)
          .order('created_at', { ascending: false })
          .limit(10);
      });

      if (!result) {
        toast.error('Database is busy. Please try again in a moment.');
        return;
      }

      const { data, error } = result;
      if (error) throw error;

      const listData = (data || []).map((d: any) => ({
        ...d,
        sentiment_distribution: d.sentiment_distribution || { positive: 0, neutral: 0, negative: 0 },
        pain_points: [],
        payment_insights: [],
        transportation_insights: [],
        price_sensitivity: [],
        move_in_barriers: [],
        property_preferences: [],
        objection_patterns: [],
        market_breakdown: {},
        ai_recommendations: [],
        member_journey_insights: [],
        customer_journeys: [],
        status: d.status || 'completed',
      })) as MemberInsight[];
      
      setInsights(listData);
      
      if (listData.length > 0 && listData[0].status === 'processing') {
        setIsAnalyzing(true);
      } else {
        setIsAnalyzing(false);
      }
      
      if (listData.length > 0) {
        await fetchInsightDetail(listData[0].id);
      } else {
        setSelectedInsight(null);
      }
    } catch (error) {
      console.error('Error fetching insights:', error);
      toast.error('Failed to load insights');
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, getPeriodFilters]);

  const fetchInsightsCallback = useCallback(() => {
    setIsLoading(true);
    fetchInsights();
    setIsAnalyzing(false);
  }, [fetchInsights]);

  const { startPolling, checkExistingAnalysis } = useMemberInsightsPolling({
    onComplete: fetchInsightsCallback
  });

  useEffect(() => {
    const init = async () => {
      await fetchInsights();
      const existingId = await checkExistingAnalysis();
      if (existingId) {
        setIsAnalyzing(true);
      }
    };
    init();
  }, [dateRange, fetchInsights, checkExistingAnalysis]);

  const getPeriodLabel = (period: string): string => {
    switch (period) {
      case 'thisWeek': return 'This Week';
      case 'lastMonth': return 'Last Month';
      case 'thisMonth': return 'This Month';
      case 'last3months': return 'Last 3 Months';
      case 'allTime': return 'All Time';
      case 'manual': return 'All Time'; // Backward compatibility
      case 'last7days': return 'Last 7 Days'; // Legacy support
      case 'last30days': return 'Last 30 Days'; // Legacy support
      default: return period;
    }
  };

  const fetchInsightDetail = async (insightId: string) => {
    setIsLoadingDetail(true);
    try {
      const result = await deduplicatedQuery(`member_insight_detail_${insightId}`, async () => {
        return await supabase
          .from('member_insights')
          .select('*')
          .eq('id', insightId)
          .maybeSingle();
      });

      if (!result) return;

      const { data, error } = result;
      if (error) throw error;
      if (!data) return;

      const typedData = {
        ...data,
        sentiment_distribution: data.sentiment_distribution as { positive: number; neutral: number; negative: number },
        pain_points: data.pain_points as any[],
        payment_insights: data.payment_insights as any[],
        transportation_insights: data.transportation_insights as any[],
        price_sensitivity: data.price_sensitivity as any[],
        move_in_barriers: data.move_in_barriers as any[],
        property_preferences: data.property_preferences as any[],
        objection_patterns: data.objection_patterns as any[],
        market_breakdown: data.market_breakdown as Record<string, any>,
        ai_recommendations: data.ai_recommendations as any[],
        member_journey_insights: data.member_journey_insights as any[],
        customer_journeys: Array.isArray(data.customer_journeys) ? (data.customer_journeys as unknown as CustomerJourney[]) : [],
      } as MemberInsight;

      setSelectedInsight(typedData);
      setInsights(prev => prev.map(i => i.id === insightId ? typedData : i));
    } catch (error) {
      console.error('Error fetching insight detail:', error);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleInsightSelect = async (insightId: string) => {
    const existingInsight = insights.find(i => i.id === insightId);
    if (existingInsight && existingInsight.pain_points.length > 0) {
      setSelectedInsight(existingInsight);
    } else {
      await fetchInsightDetail(insightId);
    }
  };

  const getDateRange = (option: DateRangeOption) => {
    const today = new Date();
    switch (option) {
      case 'thisWeek':
        // Start of week (Monday) through today
        return { start: startOfWeek(today, { weekStartsOn: 1 }), end: endOfDay(today) };
      case 'lastMonth':
        // Full previous calendar month (closed interval)
        const lastMonthDate = subMonths(today, 1);
        return { start: startOfMonth(lastMonthDate), end: endOfMonth(lastMonthDate) };
      case 'thisMonth':
        return { start: startOfMonth(today), end: endOfDay(today) };
      case 'last3months':
        // 3 calendar months back
        return { start: subMonths(today, 3), end: endOfDay(today) };
      case 'allTime':
        return { start: new Date('2024-01-01'), end: endOfDay(today) };
      default:
        return { start: startOfMonth(today), end: endOfDay(today) };
    }
  };

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const { start, end } = getDateRange(dateRange);
      
      const { data, error } = await supabase.functions.invoke('analyze-member-insights', {
        body: {
          analysis_period: dateRange, // Use actual date range option for filtering
          date_range_start: format(start, 'yyyy-MM-dd'),
          date_range_end: format(end, 'yyyy-MM-dd'),
          created_by: user?.id
        }
      });

      if (error) throw error;

      if (data.status === 'processing') {
        toast.info('Analysis started! This may take 1-3 minutes.');
        startPolling(data.insight_id);
        await fetchInsights();
      } else if (data.success) {
        toast.success(`Analysis complete! Analyzed ${data.total_calls_analyzed} calls`);
        setIsAnalyzing(false);
        await fetchInsights();
      } else {
        toast.error(data.message || 'Analysis failed');
        setIsAnalyzing(false);
      }
    } catch (error) {
      console.error('Error running analysis:', error);
      toast.error('Failed to start analysis');
      setIsAnalyzing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={(v) => onDateRangeChange(v as DateRangeOption)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="thisWeek">This Week</SelectItem>
              <SelectItem value="lastMonth">Last Month</SelectItem>
              <SelectItem value="thisMonth">This Month</SelectItem>
              <SelectItem value="last3months">Last 3 Months</SelectItem>
              <SelectItem value="allTime">All Time</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={runAnalysis} disabled={isAnalyzing}>
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Run Analysis
              </>
            )}
          </Button>

          <Button 
            variant="outline" 
            onClick={() => selectedInsight && generateMemberInsightsPDF(selectedInsight)}
            disabled={!selectedInsight}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>

        {/* Previous Analyses Selector */}
        {insights.length > 0 && (
          <Select 
            value={selectedInsight?.id || ''} 
            onValueChange={handleInsightSelect}
          >
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Select analysis" />
            </SelectTrigger>
            <SelectContent>
              {insights.map((insight) => (
                <SelectItem key={insight.id} value={insight.id}>
                  {format(new Date(insight.created_at), 'MMM d, yyyy h:mm a')} - {insight.total_calls_analyzed} calls
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Analysis In-Progress Banner */}
      {isAnalyzing && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div>
                <p className="font-medium">Analyzing booking calls...</p>
                <p className="text-sm text-muted-foreground">
                  This usually takes 1-3 minutes. You can navigate away and come back.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Analysis for Period Banner */}
      {!selectedInsight && !isLoading && !isAnalyzing && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <div>
                <p className="font-medium">No analysis for this time period</p>
                <p className="text-sm text-muted-foreground">
                  Click "Run Analysis" to generate insights for {getPeriodLabel(dateRange)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading Detail Indicator */}
      {isLoadingDetail && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
          <span className="text-sm text-muted-foreground">Loading insight details...</span>
        </div>
      )}

      {selectedInsight ? (
        <>
          {/* Failed Analysis Banner */}
          {selectedInsight.status === 'failed' && (
            <Card className="border-red-500/50 bg-red-500/5">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    <div>
                      <p className="font-medium text-red-700 dark:text-red-400">Analysis failed</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedInsight.error_message || 'The AI was unable to process this data. Please try again.'}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" onClick={runAnalysis} disabled={isAnalyzing}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Period Badge - only show if not failed */}
          {selectedInsight.status !== 'failed' && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                Showing results for: {getPeriodLabel(selectedInsight.analysis_period)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                ({format(new Date(selectedInsight.date_range_start), 'MMM d')} - {format(new Date(selectedInsight.date_range_end), 'MMM d, yyyy')})
              </span>
              <span className="text-xs text-muted-foreground">
                • Analyzed {format(new Date(selectedInsight.created_at), 'MMM d, yyyy h:mm a')}
              </span>
            </div>
          )}

          <InsightsSummaryCards insight={selectedInsight} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PainPointsPanel 
              painPoints={selectedInsight.pain_points}
              paymentInsights={selectedInsight.payment_insights}
              transportationInsights={selectedInsight.transportation_insights}
              moveInBarriers={selectedInsight.move_in_barriers}
            />
            <ObjectionsChart objections={selectedInsight.objection_patterns} />
          </div>

          <PainPointEvolutionPanel />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SentimentChart sentiment={selectedInsight.sentiment_distribution} />
            <MarketInsights marketData={selectedInsight.market_breakdown} />
          </div>

          <TrendChart />

          <RecommendationsPanel 
            recommendations={selectedInsight.ai_recommendations}
            journeyInsights={selectedInsight.member_journey_insights}
          />

          {/* Customer Journey Suggestions */}
          {selectedInsight.customer_journeys && selectedInsight.customer_journeys.length > 0 && (
            <CustomerJourneyPanel 
              journeys={selectedInsight.customer_journeys}
              totalCallsAnalyzed={selectedInsight.total_calls_analyzed}
            />
          )}
        </>
      ) : !isLoading && !isAnalyzing ? (
        <Card className="py-12">
          <CardContent className="text-center">
            <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Insights for {getPeriodLabel(dateRange)}</h3>
            <p className="text-muted-foreground mb-4">
              Run analysis to discover member trends and patterns from booking calls in this period
            </p>
            <Button onClick={runAnalysis} disabled={isAnalyzing}>
              Run Analysis for {getPeriodLabel(dateRange)}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
