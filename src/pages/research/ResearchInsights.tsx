import { useState, useCallback, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Sparkles, RefreshCw, Loader2, Database, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useResearchInsightsData, DateRangeOption } from '@/hooks/useResearchInsightsData';
import { useResearchInsightsPolling } from '@/hooks/useResearchInsightsPolling';
import { useResearchCampaigns } from '@/hooks/useResearchCampaigns';

import { ExecutiveSummary } from '@/components/research-insights/ExecutiveSummary';
import { ReasonCodeChart } from '@/components/research-insights/ReasonCodeChart';
import { IssueClustersPanel } from '@/components/research-insights/IssueClustersPanel';
import { PaymentFrictionCard } from '@/components/research-insights/PaymentFrictionCard';
import { TransferFrictionCard } from '@/components/research-insights/TransferFrictionCard';
import { BlindSpotsPanel } from '@/components/research-insights/BlindSpotsPanel';
import { HostAccountabilityPanel } from '@/components/research-insights/HostAccountabilityPanel';
import { AgentPerformanceCard } from '@/components/research-insights/AgentPerformanceCard';
import { TopActionsPanel } from '@/components/research-insights/TopActionsPanel';
import { EmergingPatternsPanel } from '@/components/research-insights/EmergingPatternsPanel';
import { HumanReviewQueue } from '@/components/research-insights/HumanReviewQueue';
import { ProcessedRecordsList } from '@/components/research-insights/ProcessedRecordsList';

export default function ResearchInsights() {
  const [dateRange, setDateRange] = useState<DateRangeOption>('allTime');
  const [campaignId, setCampaignId] = useState<string>('all');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [phase, setPhase] = useState<'processing' | 'analyzing' | null>(null);

  const {
    reports,
    selectedReport,
    processingStats,
    isLoading,
    isLoadingDetail,
    fetchReportDetail,
    generateReport,
    triggerBackfill,
    refresh,
    fetchProcessingStats,
  } = useResearchInsightsData();

  const { campaigns } = useResearchCampaigns();

  const refreshCallback = useCallback(() => {
    refresh();
    setIsGenerating(false);
    setPhase(null);
  }, [refresh]);

  const { startPolling, checkExistingAnalysis, progress } = useResearchInsightsPolling({
    onComplete: refreshCallback,
  });

  const [generationStartTime, setGenerationStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Elapsed time counter
  useEffect(() => {
    if (!isGenerating || !generationStartTime) {
      setElapsedSeconds(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - generationStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isGenerating, generationStartTime]);

  useEffect(() => {
    const init = async () => {
      const existingId = await checkExistingAnalysis();
      if (existingId) {
        setIsGenerating(true);
      }
    };
    init();
  }, [checkExistingAnalysis]);

  // Unified generate: auto-process pending records first, then generate report
  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerationStartTime(Date.now());

    // If there are pending records, process them first
    if (processingStats.pendingRecords > 0) {
      setPhase('processing');
      setIsBackfilling(true);
      await triggerBackfill();

      // Poll until all records are processed
      await new Promise<void>((resolve) => {
        const poll = setInterval(async () => {
          await fetchProcessingStats();
        }, 10000);

        const check = setInterval(() => {
          // Access latest stats via a fresh fetch
          supabase
            .from('booking_transcriptions')
            .select('id', { count: 'exact', head: true })
            .not('research_extraction', 'is', null)
            .then(({ count: processedCount }) => {
              supabase
                .from('booking_transcriptions')
                .select('id, bookings!inner(record_type, has_valid_conversation)', { count: 'exact', head: true })
                .not('call_transcription', 'is', null)
                .neq('call_transcription', '')
                .eq('bookings.record_type', 'research')
                .eq('bookings.has_valid_conversation', true)
                .then(({ count: totalCount }) => {
                  if ((totalCount || 0) - (processedCount || 0) <= 0) {
                    clearInterval(poll);
                    clearInterval(check);
                    if ((window as any).__researchBackfillPoll) {
                      clearInterval((window as any).__researchBackfillPoll);
                      delete (window as any).__researchBackfillPoll;
                    }
                    setIsBackfilling(false);
                    resolve();
                  }
                });
            });
        }, 10000);
      });

      await fetchProcessingStats();
    }

    // Now generate the report
    setPhase('analyzing');
    const insightId = await generateReport({
      campaignId: campaignId !== 'all' ? campaignId : undefined,
      analysisPeriod: dateRange,
    });

    if (insightId) {
      startPolling(insightId);
    } else {
      setIsGenerating(false);
      setPhase(null);
    }
  };

  const reportData = selectedReport?.data as any;

  return (
    <DashboardLayout title="Research Insights" subtitle="AI-processed findings from move-out research">
      {/* Controls Bar — frosted glass */}
      <div className="flex flex-wrap items-center gap-3 mb-8 p-4 rounded-xl bg-card/80 backdrop-blur border border-border shadow-sm">
        <Select value={campaignId} onValueChange={setCampaignId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Campaigns" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Campaigns</SelectItem>
            {campaigns.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRangeOption)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="thisWeek">This Week</SelectItem>
            <SelectItem value="thisMonth">This Month</SelectItem>
            <SelectItem value="lastMonth">Last Month</SelectItem>
            <SelectItem value="last3months">Last 3 Months</SelectItem>
            <SelectItem value="allTime">All Time</SelectItem>
          </SelectContent>
        </Select>

        <Button onClick={handleGenerate} disabled={isGenerating} className="gap-2">
          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {isGenerating ? 'Generating...' : 'Generate Report'}
        </Button>

        <Button onClick={refresh} variant="outline" size="icon" title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </Button>

        {reports.length > 1 && (
          <Select
            value={selectedReport?.id || ''}
            onValueChange={(id) => fetchReportDetail(id)}
          >
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Previous Reports" />
            </SelectTrigger>
            <SelectContent>
              {reports.filter(r => r.status === 'completed').map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.created_at ? format(new Date(r.created_at), 'MMM d, yyyy h:mm a') : r.id.slice(0, 8)}
                  {' '}({r.total_records_analyzed} records)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Processing Status Banner */}
      <div className="mb-8 flex flex-wrap gap-3">
        <Card className="flex-1 min-w-[250px] shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Database className="w-4.5 h-4.5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {processingStats.processedRecords} / {processingStats.totalResearchRecords} records processed
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isBackfilling
                      ? 'Processing in progress...'
                      : processingStats.pendingRecords > 0
                        ? `${processingStats.pendingRecords} pending AI processing`
                        : 'All records processed'}
                  </p>
                </div>
              </div>
            </div>
            {isBackfilling && processingStats.totalResearchRecords > 0 && (
              <Progress
                value={(processingStats.processedRecords / processingStats.totalResearchRecords) * 100}
                className="h-2"
              />
            )}
          </CardContent>
        </Card>

        {processingStats.humanReviewCount > 0 && (
          <Card className="min-w-[180px] shadow-sm border-amber-500/20">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-4.5 h-4.5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{processingStats.humanReviewCount} flagged</p>
                <p className="text-xs text-muted-foreground">Need human review</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* In-progress banner */}
      {isGenerating && (
        <div className="mb-8 rounded-xl p-6 space-y-3 border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                <Loader2 className="w-4.5 h-4.5 text-primary animate-spin" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {phase === 'processing'
                    ? `Processing ${processingStats.pendingRecords} pending records...`
                    : progress?.currentPhase === 'synthesizing'
                      ? 'Synthesizing results...'
                      : progress
                        ? `Analyzing ${progress.totalRecords} records...`
                        : 'Starting analysis...'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {phase === 'processing'
                    ? `${processingStats.processedRecords} of ${processingStats.totalResearchRecords} extracted so far`
                    : progress && progress.totalChunks > 1
                      ? `Chunk ${progress.completedChunks} of ${progress.totalChunks} complete`
                      : progress?.currentPhase === 'synthesizing'
                        ? 'Combining chunk results into final report'
                        : 'Preparing data for AI analysis'}
                </p>
              </div>
            </div>
            {elapsedSeconds > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, '0')}
              </span>
            )}
          </div>
          {progress && progress.totalChunks > 0 && (
            <Progress
              value={
                progress.currentPhase === 'synthesizing'
                  ? 90
                  : (progress.completedChunks / progress.totalChunks) * 80
              }
              className="h-2"
            />
          )}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      )}

      {/* No reports yet */}
      {!isLoading && !selectedReport && !isGenerating && (
        <Card className="shadow-sm">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No Research Insights Yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              {processingStats.processedRecords > 0
                ? `${processingStats.processedRecords} records are ready. Click "Generate Report" to analyze patterns across all processed records.`
                : `${processingStats.totalResearchRecords} research records found. Click "Process All" to extract insights from transcripts first.`}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Report content */}
      {!isLoading && selectedReport?.status === 'completed' && reportData && (
        <div className="space-y-8">
          {reportData.executive_summary && (
            <ExecutiveSummary data={reportData.executive_summary} />
          )}

          {reportData.reason_code_distribution && (
            <ReasonCodeChart data={reportData.reason_code_distribution} />
          )}

          {reportData.issue_clusters && (
            <IssueClustersPanel data={reportData.issue_clusters} />
          )}

          {reportData.top_actions && (
            <TopActionsPanel data={reportData.top_actions} />
          )}

          {(reportData.payment_friction_analysis || reportData.transfer_friction_analysis) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {reportData.payment_friction_analysis && (
                <PaymentFrictionCard data={reportData.payment_friction_analysis} />
              )}
              {reportData.transfer_friction_analysis && (
                <TransferFrictionCard data={reportData.transfer_friction_analysis} />
              )}
            </div>
          )}

          {(reportData.operational_blind_spots || reportData.host_accountability_flags) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {reportData.operational_blind_spots && (
                <BlindSpotsPanel data={reportData.operational_blind_spots} />
              )}
              {reportData.host_accountability_flags && (
                <HostAccountabilityPanel data={reportData.host_accountability_flags} />
              )}
            </div>
          )}

          {reportData.agent_performance_summary && (
            <AgentPerformanceCard data={reportData.agent_performance_summary} />
          )}

          {reportData.emerging_patterns && (
            <EmergingPatternsPanel data={reportData.emerging_patterns} />
          )}

          <HumanReviewQueue />
          <ProcessedRecordsList />
        </div>
      )}

      {/* Failed report */}
      {!isLoading && selectedReport?.status === 'failed' && (
        <Card className="border-destructive/30 shadow-sm">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-2" />
            <p className="text-sm text-foreground font-medium">Report generation failed</p>
            <p className="text-xs text-muted-foreground mt-1">{selectedReport.error_message || 'An unknown error occurred'}</p>
          </CardContent>
        </Card>
      )}

      {isLoadingDetail && (
        <div className="space-y-4 mt-6">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      )}
    </DashboardLayout>
  );
}
