import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { NonBookingSummaryCards } from '@/components/call-insights/NonBookingSummaryCards';
import { NonBookingReasonsChart } from '@/components/call-insights/NonBookingReasonsChart';
import { NonBookingMissedOpportunitiesPanel } from '@/components/call-insights/NonBookingMissedOpportunitiesPanel';
import { NonBookingSentimentChart } from '@/components/call-insights/NonBookingSentimentChart';
import { NonBookingRecommendationsPanel } from '@/components/call-insights/NonBookingRecommendationsPanel';
import { NonBookingTrendChart } from '@/components/call-insights/NonBookingTrendChart';
import { Lightbulb, RefreshCw, Download, Loader2, Phone } from 'lucide-react';
import { subDays, startOfDay } from 'date-fns';

type DateRangeOption = 'last7days' | 'last30days' | 'thisMonth' | 'last3months' | 'allTime';

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

export function NonBookingAnalysisTab({ dateRange, onDateRangeChange }: NonBookingAnalysisTabProps) {
  const [isAnalyzing] = useState(false);

  const getDateRangeDays = (option: DateRangeOption): number | null => {
    switch (option) {
      case 'last7days': return 7;
      case 'last30days': return 30;
      case 'thisMonth': return 30;
      case 'last3months': return 90;
      case 'allTime': return null;
      default: return 30;
    }
  };

  // Fetch basic stats from bookings table
  const { data: stats, isLoading } = useQuery({
    queryKey: ['non-booking-stats', dateRange],
    queryFn: async (): Promise<NonBookingStats> => {
      const days = getDateRangeDays(dateRange);
      
      let query = supabase
        .from('bookings')
        .select('id, transcription_status, call_duration_seconds')
        .eq('status', 'Non Booking');

      if (days !== null) {
        const startDate = startOfDay(subDays(new Date(), days));
        query = query.gte('booking_date', startDate.toISOString().split('T')[0]);
      }

      const { data, error } = await query;
      if (error) throw error;

      const bookings = data || [];
      const totalCalls = bookings.length;
      const transcribedCalls = bookings.filter(b => b.transcription_status === 'completed').length;
      const callsWithDuration = bookings.filter(b => b.call_duration_seconds && b.call_duration_seconds > 0);
      const avgDurationSeconds = callsWithDuration.length > 0
        ? callsWithDuration.reduce((sum, b) => sum + (b.call_duration_seconds || 0), 0) / callsWithDuration.length
        : 0;
      const highReadinessCalls = bookings.filter(b => 
        b.call_duration_seconds && b.call_duration_seconds > 300
      ).length;

      return {
        totalCalls,
        transcribedCalls,
        avgDurationSeconds,
        highReadinessCalls,
      };
    },
  });

  const handleRunAnalysis = () => {
    // Future: Will trigger edge function
    // For now, show coming soon tooltip
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

  // Show empty state if no non-booking calls
  const hasData = stats && stats.totalCalls > 0;
  const hasInsights = false; // Will be true when AI analysis is implemented

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

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button onClick={handleRunAnalysis} disabled>
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
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Coming soon - AI analysis for non-booking calls</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button variant="outline" disabled>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {hasData ? (
        <>
          {/* Summary Cards */}
          <NonBookingSummaryCards stats={stats} />

          {/* Analytics Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <NonBookingReasonsChart 
              onRunAnalysis={handleRunAnalysis}
              isAnalyzing={isAnalyzing}
            />
            <NonBookingMissedOpportunitiesPanel 
              highReadinessCount={stats.highReadinessCalls}
              dateRange={dateRange}
            />
          </div>

          {/* Analytics Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <NonBookingSentimentChart />
            <Card className="h-full">
              <CardContent className="pt-6 h-full flex flex-col items-center justify-center text-center min-h-[280px]">
                <div className="p-4 rounded-full bg-primary/10 mb-4">
                  <Phone className="h-8 w-8 text-primary" />
                </div>
                <h4 className="font-medium mb-2">Agent Breakdown</h4>
                <p className="text-sm text-muted-foreground max-w-[280px]">
                  Coming soon - See which agents have the highest non-booking rates
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Trend Chart */}
          <NonBookingTrendChart dateRange={dateRange} />

          {/* Recommendations Panel */}
          <NonBookingRecommendationsPanel />
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
