import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePageTracking } from '@/hooks/usePageTracking';
import { supabase } from '@/integrations/supabase/client';
import { deduplicatedQuery } from '@/utils/databaseCircuitBreaker';
import { useMemberInsightsPolling } from '@/hooks/useMemberInsightsPolling';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lightbulb, RefreshCw, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { format, subDays, startOfMonth } from 'date-fns';
import { generateMemberInsightsPDF } from '@/utils/memberInsightsPDF';
import InsightsSummaryCards from '@/components/member-insights/InsightsSummaryCards';
import PainPointsPanel from '@/components/member-insights/PainPointsPanel';
import ObjectionsChart from '@/components/member-insights/ObjectionsChart';
import MarketInsights from '@/components/member-insights/MarketInsights';
import RecommendationsPanel from '@/components/member-insights/RecommendationsPanel';
import SentimentChart from '@/components/member-insights/SentimentChart';
import TrendChart from '@/components/member-insights/TrendChart';

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
  created_at: string;
  status?: 'processing' | 'completed' | 'failed';
}

type DateRangeOption = 'last7days' | 'last30days' | 'thisMonth' | 'last3months' | 'allTime';

const MemberInsights = () => {
  usePageTracking('view_member_insights');
  const { user } = useAuth();
  const [insights, setInsights] = useState<MemberInsight[]>([]);
  const [selectedInsight, setSelectedInsight] = useState<MemberInsight | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeOption>('last30days');
  const [dbSlowMode, setDbSlowMode] = useState(false);

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
          .select('id, analysis_period, date_range_start, date_range_end, total_calls_analyzed, created_at, status')
          .in('analysis_period', periodFilters)
          .order('created_at', { ascending: false })
          .limit(10);
      });

      if (!result) {
        setDbSlowMode(true);
        toast.error('Database is busy. Please try again in a moment.');
        return;
      }

      const { data, error } = result;
      if (error) throw error;

      const listData = (data || []).map((d: any) => ({
        ...d,
        sentiment_distribution: { positive: 0, neutral: 0, negative: 0 },
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


  // Phase 2: Fetch full detail for a specific insight
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

      if (!result) {
        setDbSlowMode(true);
        return;
      }

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
      } as MemberInsight;

      setSelectedInsight(typedData);
      
      // Update the insights list with full data for this item
      setInsights(prev => prev.map(i => i.id === insightId ? typedData : i));
    } catch (error) {
      console.error('Error fetching insight detail:', error);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Handle insight selection - load full detail if needed
  const handleInsightSelect = async (insightId: string) => {
    const existingInsight = insights.find(i => i.id === insightId);
    
    // Check if we already have full data (pain_points populated)
    if (existingInsight && existingInsight.pain_points.length > 0) {
      setSelectedInsight(existingInsight);
    } else {
      await fetchInsightDetail(insightId);
    }
  };

  const getDateRange = (option: DateRangeOption) => {
    const today = new Date();
    switch (option) {
      case 'last7days':
        return { start: subDays(today, 7), end: today };
      case 'last30days':
        return { start: subDays(today, 30), end: today };
      case 'thisMonth':
        return { start: startOfMonth(today), end: today };
      case 'last3months':
        return { start: subDays(today, 90), end: today };
      case 'allTime':
        return { start: new Date('2024-01-01'), end: today };
      default:
        return { start: subDays(today, 30), end: today };
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
        toast.info('Analysis started! This may take 1-3 minutes. You can navigate away safely.');
        startPolling(data.insight_id);
        // Refresh the list to show the processing entry
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
      <DashboardLayout title="Member Insights">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Member Insights">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Lightbulb className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Member Insights</h1>
              <p className="text-muted-foreground text-sm">
                AI-powered analysis of member call patterns and trends
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRangeOption)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last7days">Last 7 Days</SelectItem>
                <SelectItem value="last30days">Last 30 Days</SelectItem>
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
              Export PDF
            </Button>
          </div>
        </div>

        {/* Previous Analyses Selector */}
        {insights.length > 0 && (
          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Previous Analyses</CardTitle>
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
                        {format(new Date(insight.created_at), 'MMM d, yyyy h:mm a')} - {insight.total_calls_analyzed} calls ({insight.analysis_period})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
          </Card>
        )}

        {/* DB Slow Mode Warning */}
        {dbSlowMode && (
          <Card className="border-amber-500/50 bg-amber-500/10">
            <CardContent className="py-3">
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Database is busy. Data may be delayed or incomplete.
              </p>
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
            {/* Summary Cards */}
            <InsightsSummaryCards insight={selectedInsight} />

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pain Points */}
              <PainPointsPanel 
                painPoints={selectedInsight.pain_points}
                paymentInsights={selectedInsight.payment_insights}
                transportationInsights={selectedInsight.transportation_insights}
                moveInBarriers={selectedInsight.move_in_barriers}
              />

              {/* Objections Chart */}
              <ObjectionsChart objections={selectedInsight.objection_patterns} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sentiment Distribution */}
              <SentimentChart sentiment={selectedInsight.sentiment_distribution} />

              {/* Market Insights */}
              <MarketInsights marketData={selectedInsight.market_breakdown} />
            </div>

            {/* Trend Chart */}
            <TrendChart insights={insights} />

            {/* AI Recommendations */}
            <RecommendationsPanel 
              recommendations={selectedInsight.ai_recommendations}
              journeyInsights={selectedInsight.member_journey_insights}
            />
          </>
        ) : (
          <Card className="py-12">
            <CardContent className="text-center">
              <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Insights Yet</h3>
              <p className="text-muted-foreground mb-4">
                Run your first analysis to discover member trends and patterns
              </p>
              <Button onClick={runAnalysis} disabled={isAnalyzing}>
                {isAnalyzing ? 'Analyzing...' : 'Run First Analysis'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default MemberInsights;