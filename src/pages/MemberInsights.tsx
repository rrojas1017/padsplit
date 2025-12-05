import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePageTracking } from '@/hooks/usePageTracking';
import { supabase } from '@/integrations/supabase/client';
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
}

type DateRangeOption = 'last7days' | 'last30days' | 'thisMonth' | 'last3months' | 'allTime';

const MemberInsights = () => {
  usePageTracking('view_member_insights');
  const { user } = useAuth();
  const [insights, setInsights] = useState<MemberInsight[]>([]);
  const [selectedInsight, setSelectedInsight] = useState<MemberInsight | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeOption>('last30days');

  useEffect(() => {
    fetchInsights();
  }, []);

  const fetchInsights = async () => {
    try {
      const { data, error } = await supabase
        .from('member_insights')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Type assertion for the data - handle Json types
      const typedData = (data || []).map((d: any) => ({
        ...d,
        sentiment_distribution: d.sentiment_distribution as { positive: number; neutral: number; negative: number },
        pain_points: d.pain_points as any[],
        payment_insights: d.payment_insights as any[],
        transportation_insights: d.transportation_insights as any[],
        price_sensitivity: d.price_sensitivity as any[],
        move_in_barriers: d.move_in_barriers as any[],
        property_preferences: d.property_preferences as any[],
        objection_patterns: d.objection_patterns as any[],
        market_breakdown: d.market_breakdown as Record<string, any>,
        ai_recommendations: d.ai_recommendations as any[],
        member_journey_insights: d.member_journey_insights as any[],
      })) as MemberInsight[];
      setInsights(typedData);
      if (typedData.length > 0) {
        setSelectedInsight(typedData[0]);
      }
    } catch (error) {
      console.error('Error fetching insights:', error);
      toast.error('Failed to load insights');
    } finally {
      setIsLoading(false);
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

      if (data.success) {
        toast.success(`Analysis complete! Analyzed ${data.total_calls_analyzed} calls`);
        await fetchInsights();
      } else {
        toast.error(data.message || 'Analysis failed');
      }
    } catch (error) {
      console.error('Error running analysis:', error);
      toast.error('Failed to run analysis');
    } finally {
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
                  onValueChange={(id) => setSelectedInsight(insights.find(i => i.id === id) || null)}
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