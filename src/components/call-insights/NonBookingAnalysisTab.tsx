import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { NonBookingSummaryCards } from '@/components/call-insights/NonBookingSummaryCards';
import { NonBookingReasonsChart } from '@/components/call-insights/NonBookingReasonsChart';
import { NonBookingMissedOpportunitiesPanel } from '@/components/call-insights/NonBookingMissedOpportunitiesPanel';
import { NonBookingSentimentChart } from '@/components/call-insights/NonBookingSentimentChart';
import { NonBookingRecommendationsPanel } from '@/components/call-insights/NonBookingRecommendationsPanel';
import { NonBookingTrendChart } from '@/components/call-insights/NonBookingTrendChart';
import { useNonBookingInsightsPolling } from '@/hooks/useNonBookingInsightsPolling';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, RefreshCw, Download, Loader2, Phone, Clock, Sparkles } from 'lucide-react';
import { subMonths, startOfMonth, endOfMonth, startOfWeek, endOfDay, format } from 'date-fns';
import { toast } from 'sonner';

type DateRangeOption = 'thisWeek' | 'lastMonth' | 'thisMonth' | 'last3months' | 'allTime';

interface NonBookingAnalysisTabProps {
  dateRange: DateRangeOption;
  onDateRangeChange: (range: DateRangeOption) => void;
}

interface NonBookingStats {
  totalCalls: number;
  transcribedCalls: number;
  avgDurationSeconds: number;
  highReadinessCalls: number;
}

interface NonBookingInsight {
  id: string;
  analysis_period: string;
  date_range_start: string;
  date_range_end: string;
  total_calls_analyzed: number;
  rejection_reasons: any[];
  missed_opportunities: any[];
  sentiment_distribution: any;
  objection_patterns: any[];
  recovery_recommendations: any[];
  agent_breakdown: any;
  market_breakdown: any;
  status: string;
  created_at: string;
}

export function NonBookingAnalysisTab({ dateRange, onDateRangeChange }: NonBookingAnalysisTabProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedInsightId, setSelectedInsightId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const getPeriodLabel = (period: string): string => {
    switch (period) {
      case 'thisWeek': return 'This Week';
      case 'lastMonth': return 'Last Month';
      case 'thisMonth': return 'This Month';
      case 'last3months': return 'Last 3 Months';
      case 'allTime': return 'All Time';
      case 'last7days': return 'Last 7 Days'; // Legacy support
      case 'last30days': return 'Last 30 Days'; // Legacy support
      default: return period;
    }
  };

  const getDateRangeParams = (option: DateRangeOption) => {
    const today = new Date();
    let startDate: Date;
    let endDate: Date;
    
    switch (option) {
      case 'thisWeek':
        startDate = startOfWeek(today, { weekStartsOn: 1 });
        endDate = endOfDay(today);
        break;
      case 'lastMonth':
        const lastMonthDate = subMonths(today, 1);
        startDate = startOfMonth(lastMonthDate);
        endDate = endOfMonth(lastMonthDate);
        break;
      case 'thisMonth':
        startDate = startOfMonth(today);
        endDate = endOfDay(today);
        break;
      case 'last3months':
        startDate = subMonths(today, 3);
        endDate = endOfDay(today);
        break;
      case 'allTime':
        startDate = new Date('2024-01-01');
        endDate = endOfDay(today);
        break;
      default:
        startDate = startOfMonth(today);
        endDate = endOfDay(today);
    }
    
    return {
      start: format(startDate, 'yyyy-MM-dd'),
      end: format(endDate, 'yyyy-MM-dd'),
      period: option
    };
  };

  // Helper for server-side stats query
  const getStatsStartDate = (option: DateRangeOption): string | null => {
    const params = getDateRangeParams(option);
    if (option === 'allTime') return null;
    return params.start;
  };

  // Fetch stats using server-side aggregation
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['non-booking-stats', dateRange],
    queryFn: async (): Promise<NonBookingStats> => {
      const startDate = getStatsStartDate(dateRange);
      
      const { data, error } = await supabase.rpc('get_non_booking_stats', {
        start_date: startDate
      });

      if (error) throw error;

      const result = data?.[0] || { total_calls: 0, transcribed_calls: 0, high_readiness_calls: 0, avg_duration_seconds: 0 };

      return {
        totalCalls: Number(result.total_calls) || 0,
        transcribedCalls: Number(result.transcribed_calls) || 0,
        avgDurationSeconds: Number(result.avg_duration_seconds) || 0,
        highReadinessCalls: Number(result.high_readiness_calls) || 0,
      };
    },
  });

  // Fetch previous insights - FILTER BY DATE RANGE using actual date overlap
  const { data: previousInsights, refetch: refetchInsights } = useQuery({
    queryKey: ['non-booking-insights-list', dateRange],
    queryFn: async (): Promise<NonBookingInsight[]> => {
      const { data, error } = await supabase
        .from('non_booking_insights')
        .select('*')
        .eq('status', 'completed')
        .eq('analysis_period', dateRange)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return (data || []) as NonBookingInsight[];
    },
  });

  // Fetch selected insight details
  const { data: selectedInsight, isLoading: insightLoading } = useQuery({
    queryKey: ['non-booking-insight', selectedInsightId],
    queryFn: async (): Promise<NonBookingInsight | null> => {
      if (!selectedInsightId) return null;
      
      const { data, error } = await supabase
        .from('non_booking_insights')
        .select('*')
        .eq('id', selectedInsightId)
        .single();

      if (error) throw error;
      return data as NonBookingInsight;
    },
    enabled: !!selectedInsightId,
  });

  // Polling hook
  const { startPolling, checkExistingAnalysis } = useNonBookingInsightsPolling({
    onComplete: () => {
      setIsAnalyzing(false);
      refetchInsights();
      queryClient.invalidateQueries({ queryKey: ['non-booking-insight'] });
    }
  });

  // Check for existing processing analysis on mount
  useEffect(() => {
    const checkProcessing = async () => {
      const processingId = await checkExistingAnalysis();
      if (processingId) {
        setIsAnalyzing(true);
      }
    };
    checkProcessing();
  }, [checkExistingAnalysis]);

  // Auto-select latest insight for current date range (reset when date range changes)
  useEffect(() => {
    if (previousInsights) {
      if (previousInsights.length > 0) {
        // Auto-select most recent insight for this period
        setSelectedInsightId(previousInsights[0].id);
      } else {
        // No insights for this period - clear selection
        setSelectedInsightId(null);
      }
    }
  }, [previousInsights, dateRange]);

  const handleRunAnalysis = async () => {
    if (isAnalyzing) return;
    
    if (!stats || stats.transcribedCalls === 0) {
      toast.error('No transcribed Non-Booking calls available for analysis');
      return;
    }

    setIsAnalyzing(true);
    const params = getDateRangeParams(dateRange);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-non-booking-insights', {
        body: {
          analysis_period: params.period,
          date_range_start: params.start,
          date_range_end: params.end
        }
      });

      if (error) throw error;

      if (data?.insight_id) {
        toast.info('Non-Booking analysis started. This may take 30-60 seconds...');
        startPolling(data.insight_id);
        setSelectedInsightId(data.insight_id);
      } else {
        throw new Error('No insight ID returned');
      }
    } catch (error) {
      console.error('Error starting analysis:', error);
      toast.error('Failed to start Non-Booking analysis');
      setIsAnalyzing(false);
    }
  };

  if (statsLoading) {
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

  const hasData = stats && stats.totalCalls > 0;
  const hasTranscribed = stats && stats.transcribedCalls > 0;

  // Format reasons for chart
  const formattedReasons = selectedInsight?.rejection_reasons?.map((r: any) => ({
    reason: r.reason,
    count: r.count || 0,
    percentage: r.percentage || 0
  })) || [];

  // Format sentiment for chart
  const formattedSentiment = selectedInsight?.sentiment_distribution || null;

  // Format missed opportunities
  const formattedMissedOpportunities = selectedInsight?.missed_opportunities || [];

  // Format recommendations
  const formattedRecommendations = selectedInsight?.recovery_recommendations || [];
  const formattedObjections = selectedInsight?.objection_patterns?.map((o: any) => ({
    pattern: o.objection,
    frequency: o.percentage || o.frequency || 0,
    suggestion: o.suggested_response
  })) || [];

  return (
    <div className="space-y-6">
      {/* Controls Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
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

          <Button 
            onClick={handleRunAnalysis} 
            disabled={isAnalyzing || !hasTranscribed}
          >
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

          {previousInsights && previousInsights.length > 0 && (
            <Select 
              value={selectedInsightId || ''} 
              onValueChange={setSelectedInsightId}
            >
              <SelectTrigger className="w-[200px]">
                <Clock className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Previous analyses" />
              </SelectTrigger>
              <SelectContent>
                {previousInsights.map((insight) => (
                  <SelectItem key={insight.id} value={insight.id}>
                    <span className="flex items-center gap-2">
                      <span>{getPeriodLabel(insight.analysis_period)}</span>
                      <span className="text-muted-foreground text-xs">
                        {format(new Date(insight.created_at), 'MMM d, h:mm a')}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button variant="outline" disabled>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Analysis Status Banner */}
      {isAnalyzing && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div>
                <p className="font-medium">Analyzing Non-Booking calls...</p>
                <p className="text-sm text-muted-foreground">
                  This usually takes 30-60 seconds. You can navigate away and come back.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Analysis for Period Banner */}
      {!selectedInsight && hasTranscribed && !isAnalyzing && (
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

      {hasData ? (
        <>
          {/* Period Badge */}
          {selectedInsight && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                Showing results for: {getPeriodLabel(selectedInsight.analysis_period)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Analyzed {format(new Date(selectedInsight.created_at), 'MMM d, yyyy h:mm a')}
              </span>
            </div>
          )}

          {/* Summary Cards */}
          <NonBookingSummaryCards stats={stats} />

          {/* Analytics Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <NonBookingReasonsChart 
              reasons={formattedReasons}
              onRunAnalysis={handleRunAnalysis}
              isAnalyzing={isAnalyzing}
            />
            <NonBookingMissedOpportunitiesPanel 
              highReadinessCount={stats.highReadinessCalls}
              dateRange={dateRange}
              missedOpportunities={formattedMissedOpportunities}
            />
          </div>

          {/* Analytics Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <NonBookingSentimentChart sentiment={formattedSentiment} />
            <Card className="h-full">
              <CardContent className="pt-6 h-full flex flex-col min-h-[280px]">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 rounded-full bg-primary/10">
                    <Phone className="h-5 w-5 text-primary" />
                  </div>
                  <h4 className="font-medium">Agent Breakdown</h4>
                </div>
                {selectedInsight?.agent_breakdown && Object.keys(selectedInsight.agent_breakdown).length > 0 ? (
                  <div className="flex-1 overflow-y-auto space-y-2 max-h-[320px]">
                    {Object.entries(selectedInsight.agent_breakdown)
                      .sort((a: [string, any], b: [string, any]) => 
                        (b[1].non_booking_count || 0) - (a[1].non_booking_count || 0)
                      )
                      .map(([agent, data]: [string, any]) => (
                      <div key={agent} className="p-3 bg-muted rounded-lg space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{agent}</span>
                          <Badge variant="secondary" className="text-xs">
                            {data.non_booking_count || 0} non-bookings
                          </Badge>
                        </div>
                        {data.top_objection && data.top_objection !== 'none' && (
                          <p className="text-xs text-muted-foreground">
                            Top objection: {data.top_objection}
                          </p>
                        )}
                        {data.improvement_area && data.improvement_area !== 'Review call recordings for coaching opportunities' && (
                          <p className="text-xs text-primary/80 mt-1">
                            💡 {data.improvement_area}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-sm text-muted-foreground text-center max-w-[280px]">
                      Run analysis to see which agents have the highest non-booking rates
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Trend Chart */}
          <NonBookingTrendChart dateRange={dateRange} />

          {/* Recommendations Panel */}
          <NonBookingRecommendationsPanel 
            recommendations={formattedRecommendations}
            recoveryPatterns={formattedObjections}
          />
        </>
      ) : (
        <Card className="py-12">
          <CardContent className="text-center">
            <div className="p-4 rounded-full bg-amber-500/10 mx-auto w-fit mb-4">
              <Lightbulb className="h-12 w-12 text-amber-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Non-Booking Calls Yet</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Non-booking calls from your team will appear here for analysis.
              Import historical data or wait for new calls to be logged.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
