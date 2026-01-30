import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { deduplicatedQuery } from '@/utils/databaseCircuitBreaker';
import { useMemberInsightsPolling } from '@/hooks/useMemberInsightsPolling';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
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
  avg_call_duration_seconds?: number;
  created_at: string;
  status?: 'processing' | 'completed' | 'failed';
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

type DateRangeOption = 'last7days' | 'last30days' | 'thisMonth' | 'last3months' | 'allTime';

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

  const fetchInsightsCallback = useCallback(() => {
    fetchInsights();
    setIsAnalyzing(false);
  }, []);

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
  }, []);

  const fetchInsights = async () => {
    try {
      const result = await deduplicatedQuery('member_insights_list', async () => {
        return await supabase
          .from('member_insights')
          .select('id, analysis_period, date_range_start, date_range_end, total_calls_analyzed, created_at, status')
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
      }
    } catch (error) {
      console.error('Error fetching insights:', error);
      toast.error('Failed to load insights');
    } finally {
      setIsLoading(false);
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
          analysis_period: 'manual',
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

      {/* Loading Detail Indicator */}
      {isLoadingDetail && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
          <span className="text-sm text-muted-foreground">Loading insight details...</span>
        </div>
      )}

      {selectedInsight ? (
        <>
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SentimentChart sentiment={selectedInsight.sentiment_distribution} />
            <MarketInsights marketData={selectedInsight.market_breakdown} />
          </div>

          <TrendChart insights={insights} />

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
              Run your first analysis to discover member trends and patterns from booking calls
            </p>
            <Button onClick={runAnalysis} disabled={isAnalyzing}>
              {isAnalyzing ? 'Analyzing...' : 'Run First Analysis'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
