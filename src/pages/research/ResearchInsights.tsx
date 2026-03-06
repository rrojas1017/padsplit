import { useState, useCallback, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Sparkles, RefreshCw, Loader2, Database, AlertTriangle, CheckCircle } from 'lucide-react';
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
import { PriorityGlossary } from '@/components/research-insights/PriorityGlossary';
import { ReasonCodeDrillDown } from '@/components/research-insights/ReasonCodeDrillDown';

export default function ResearchInsights() {
  const [dateRange, setDateRange] = useState<DateRangeOption>('allTime');
  const [campaignId, setCampaignId] = useState<string>('all');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [drillDown, setDrillDown] = useState<{
    open: boolean;
    groupName: string;
    bookingIds?: string[];
    reasonCodes?: string[];
  }>({ open: false, groupName: '' });

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
  }, [refresh]);

  const { startPolling, checkExistingAnalysis } = useResearchInsightsPolling({
    onComplete: refreshCallback,
  });

  useEffect(() => {
    const init = async () => {
      const existingId = await checkExistingAnalysis();
      if (existingId) {
        setIsGenerating(true);
      }
    };
    init();
  }, [checkExistingAnalysis]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    const insightId = await generateReport({
      campaignId: campaignId !== 'all' ? campaignId : undefined,
      analysisPeriod: dateRange,
    });

    if (insightId) {
      startPolling(insightId);
    } else {
      setIsGenerating(false);
    }
  };

  const handleBackfill = async () => {
    setIsBackfilling(true);
    await triggerBackfill();
  };

  // Auto-stop backfilling when all records are processed
  useEffect(() => {
    if (isBackfilling && processingStats.pendingRecords === 0 && processingStats.totalResearchRecords > 0) {
      setIsBackfilling(false);
      // Clear the polling interval
      if ((window as any).__researchBackfillPoll) {
        clearInterval((window as any).__researchBackfillPoll);
        delete (window as any).__researchBackfillPoll;
      }
      toast.success(`All ${processingStats.processedRecords} records processed!`);
    }
  }, [isBackfilling, processingStats]);

  const reportData = selectedReport?.data as any;

  const getPeriodLabel = (period: string): string => {
    switch (period) {
      case 'thisWeek': return 'This Week';
      case 'lastMonth': return 'Last Month';
      case 'thisMonth': return 'This Month';
      case 'last3months': return 'Last 3 Months';
      case 'allTime': return 'All Time';
      default: return period || 'All Time';
    }
  };

  return (
    <DashboardLayout title="Research Insights" subtitle="AI-processed findings from move-out research">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
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

        {/* Previous reports selector */}
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
      <div className="mb-6 flex flex-wrap gap-3">
        <Card className="flex-1 min-w-[250px]">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Database className="w-5 h-5 text-primary" />
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
              {processingStats.pendingRecords > 0 && (
                <Button onClick={handleBackfill} disabled={isBackfilling} variant="outline" size="sm" className="gap-1.5">
                  {isBackfilling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  {isBackfilling ? 'Processing...' : 'Process All'}
                </Button>
              )}
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
          <Card className="min-w-[180px]">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
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
        <div className="mb-6 bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
          <p className="text-sm text-foreground">Generating research insights... This may take a few minutes.</p>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      )}

      {/* No reports yet */}
      {!isLoading && !selectedReport && !isGenerating && (
        <Card>
          <CardContent className="p-12 text-center">
            <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Research Insights Yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {processingStats.processedRecords > 0
                ? `${processingStats.processedRecords} records are ready. Click "Generate Report" to analyze patterns across all processed records.`
                : `${processingStats.totalResearchRecords} research records found. Click "Process All" to extract insights from transcripts first.`}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Report content */}
      {!isLoading && selectedReport?.status === 'completed' && reportData && (
        <div className="space-y-6">
          {reportData.executive_summary && (
            <ExecutiveSummary data={reportData.executive_summary} />
          )}

          <PriorityGlossary />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {reportData.reason_code_distribution && (
              <div className="lg:col-span-2">
                <ReasonCodeChart
                  data={reportData.reason_code_distribution}
                  onGroupClick={(groupName, bookingIds, reasonCodes) =>
                    setDrillDown({ open: true, groupName, bookingIds, reasonCodes })
                  }
                />
              </div>
            )}

            {reportData.issue_clusters && (
              <div className="lg:col-span-2">
                <IssueClustersPanel
                  data={reportData.issue_clusters}
                  onClusterClick={(clusterName, bookingIds, reasonCodes) =>
                    setDrillDown({ open: true, groupName: clusterName, bookingIds, reasonCodes })
                  }
                />
              </div>
            )}

            {reportData.payment_friction_analysis && (
              <PaymentFrictionCard data={reportData.payment_friction_analysis} />
            )}

            {reportData.transfer_friction_analysis && (
              <TransferFrictionCard data={reportData.transfer_friction_analysis} />
            )}

            {reportData.top_actions && (
              <div className="lg:col-span-2">
                <TopActionsPanel data={reportData.top_actions} />
              </div>
            )}

            {reportData.operational_blind_spots && (
              <BlindSpotsPanel data={reportData.operational_blind_spots} />
            )}

            {reportData.host_accountability_flags && (
              <HostAccountabilityPanel data={reportData.host_accountability_flags} />
            )}

            {reportData.agent_performance_summary && (
              <div className="lg:col-span-2">
                <AgentPerformanceCard data={reportData.agent_performance_summary} />
              </div>
            )}

            {reportData.emerging_patterns && (
              <div className="lg:col-span-2">
                <EmergingPatternsPanel data={reportData.emerging_patterns} />
              </div>
            )}
          </div>

          <HumanReviewQueue onReviewComplete={() => { refresh(); fetchProcessingStats(); }} />
          <ProcessedRecordsList />

          <ReasonCodeDrillDown
            open={drillDown.open}
            onOpenChange={(open) => setDrillDown(prev => ({ ...prev, open }))}
            groupName={drillDown.groupName}
            bookingIds={drillDown.bookingIds}
            reasonCodesIncluded={drillDown.reasonCodes}
            campaignId={campaignId !== 'all' ? campaignId : undefined}
            dateRangeStart={selectedReport?.date_range_start || undefined}
            dateRangeEnd={selectedReport?.date_range_end || undefined}
          />
        </div>
      )}

      {/* Failed report */}
      {!isLoading && selectedReport?.status === 'failed' && (
        <Card className="border-destructive/30">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-2" />
            <p className="text-sm text-foreground font-medium">Report generation failed</p>
            <p className="text-xs text-muted-foreground mt-1">{selectedReport.error_message || 'An unknown error occurred'}</p>
          </CardContent>
        </Card>
      )}

      {/* Loading detail */}
      {isLoadingDetail && (
        <div className="space-y-4 mt-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}
    </DashboardLayout>
  );
}
