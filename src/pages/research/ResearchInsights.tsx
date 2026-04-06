import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Sparkles, RefreshCw, Loader2, Database, AlertTriangle, LayoutDashboard, SearchCode, Settings2, ChevronDown, FileText, Users } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useResearchInsightsData, DateRangeOption } from '@/hooks/useResearchInsightsData';
import { useResearchInsightsPolling } from '@/hooks/useResearchInsightsPolling';
import { useResearchCampaigns } from '@/hooks/useResearchCampaigns';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { deriveKPIs, isAudienceSurveyData } from '@/types/research-insights';
import type { AudienceSurveyInsightData, CampaignType } from '@/types/research-insights';
import { generateMoveOutDocx } from '@/utils/generate-executive-docx';
import { useCostAlertMonitor } from '@/hooks/useCostAlertMonitor';

// Old research-insights components (still used by some features)
import { HumanReviewQueue } from '@/components/research-insights/HumanReviewQueue';
import type { ExtendedKPIs } from '@/components/research-insights/InsightsKPIRow';
import { ReasonCodeDrillDown } from '@/components/research-insights/ReasonCodeDrillDown';

// New move-out insights components
import { MoveOutKPIGrid } from '@/components/moveout-insights/MoveOutKPIGrid';
import { MoveOutOverview } from '@/components/moveout-insights/MoveOutOverview';
import { MoveOutIssuesTab } from '@/components/moveout-insights/MoveOutIssuesTab';
import { MoveOutOperationsTab } from '@/components/moveout-insights/MoveOutOperationsTab';
import { MoveOutMemberTab } from '@/components/moveout-insights/MoveOutMemberTab';

import { AudienceSurveyDashboard } from '@/components/audience-survey/AudienceSurveyDashboard';
import { AudienceSurveyInsightsDashboard } from '@/components/audience-survey/AudienceSurveyInsightsDashboard';
import { ScriptInsightsPanel } from '@/components/research-insights/ScriptInsightsPanel';
import { ExportMembersModal } from '@/components/research-insights/ExportMembersModal';
import { exportFullReport } from '@/utils/export-report';
import type { ExportFilter } from '@/hooks/useExportMembers';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type TabValue = 'overview' | 'issues' | 'operations' | 'members';

export default function ResearchInsights() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get('tab') as TabValue) || 'overview';
  const setTab = (tab: string) => setSearchParams({ tab, campaign: campaignType }, { replace: true });

  const [campaignType, setCampaignType] = useState<CampaignType>(
    (searchParams.get('campaign') as CampaignType)
    || (localStorage.getItem('research_insights_campaign') as CampaignType)
    || 'move_out_survey'
  );
  const [dateRange, setDateRange] = useState<DateRangeOption>('allTime');
  const [campaignId, setCampaignId] = useState<string>('all');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [phase, setPhase] = useState<'processing' | 'analyzing' | null>(null);
  const [drillDownCode, setDrillDownCode] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFilter, setExportFilter] = useState<ExportFilter>({ type: 'full_report' });
  const [exportTitle, setExportTitle] = useState('Export Members');
  const [exportFilename, setExportFilename] = useState('export.csv');
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);

  const { isAdmin } = useIsAdmin();

  const openExportModal = useCallback((filter: ExportFilter, title: string, filename: string) => {
    if (!isAdmin) return;
    setExportFilter(filter);
    setExportTitle(title);
    setExportFilename(filename);
    setExportModalOpen(true);
  }, [isAdmin]);

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
  } = useResearchInsightsData(campaignType);

  const { campaigns } = useResearchCampaigns();

  // Fetch active scripts for the dropdown
  const { data: activeScripts = [] } = useQuery({
    queryKey: ['research-scripts-for-insights'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('research_scripts')
        .select('id, name, slug')
        .eq('is_active', true)
        .not('campaign_type', 'in', '("move_out_survey","audience_survey")')
        .order('name');
      // Filter out legacy scripts that have dedicated hardcoded dashboards
      const filtered = (data || []).filter(s => 
        !['satisfaction', 'audience_survey', 'move_out_survey'].includes((s as any).slug || '')
      );
      if (error) throw error;
      return filtered;
    },
  });

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

  // Auto-trigger reclassification of "Other" records (once per 24h, silent)
  useEffect(() => {
    const runOnce = async () => {
      const lastRun = localStorage.getItem('reclassify_last_triggered');
      const now = Date.now();
      if (lastRun && now - parseInt(lastRun) < 86400000) return;

      const { count } = await supabase
        .from('booking_transcriptions')
        .select('id', { count: 'exact', head: true })
        .eq('research_campaign_type', 'move_out_survey')
        .not('research_classification', 'is', null)
        .is('research_audit', null)
        .or('research_classification->>primary_reason_code.ilike.%other%,research_classification->>primary_reason_code.ilike.%unspecified%,research_classification->>primary_reason_code.ilike.%unknown%,research_classification->>primary_reason_code.ilike.%general%');

      if (count && count > 0) {
        await supabase.functions.invoke('reclassify-records');
        localStorage.setItem('reclassify_last_triggered', now.toString());
        console.log(`Reclassification triggered for ${count} records`);
      }
    };
    runOnce();
  }, []);

  useEffect(() => {
    const init = async () => {
      const existingId = await checkExistingAnalysis();
      if (existingId) {
        setIsGenerating(true);
      }
    };
    init();
  }, [checkExistingAnalysis]);

  const handleCampaignTypeChange = (value: string) => {
    setCampaignType(value as CampaignType);
    localStorage.setItem('research_insights_campaign', value);
    setSearchParams({ tab: currentTab, campaign: value }, { replace: true });
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerationStartTime(Date.now());

    if (processingStats.pendingRecords > 0) {
      setPhase('processing');
      setIsBackfilling(true);
      await triggerBackfill();

      await new Promise<void>((resolve) => {
        const poll = setInterval(async () => {
          await fetchProcessingStats();
        }, 10000);

        const check = setInterval(() => {
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

  const handleManualRegenerate = () => {
    setShowRegenConfirm(true);
  };

  const confirmRegenerate = () => {
    setShowRegenConfirm(false);
    handleGenerate();
  };

  const reportData = selectedReport?.data as any;
  const isAudienceSurvey = campaignType === 'audience_survey';
  const isScriptView = campaignType.startsWith('script:');
  const selectedScriptId = isScriptView ? campaignType.replace('script:', '') : null;

  const mappedStats = {
    total_research_records: processingStats.totalResearchRecords,
    processed_records: processingStats.processedRecords,
    flagged_for_review: processingStats.humanReviewCount,
    pending_records: processingStats.pendingRecords,
    failed_records: 0,
  };
  const baseKpis = !isAudienceSurvey ? deriveKPIs(reportData, mappedStats) : null;
  const es = reportData?.executive_summary;
  const firstReason = reportData?.reason_code_distribution?.[0];
  const kpis: ExtendedKPIs | null = baseKpis ? {
    ...baseKpis,
    totalCases: selectedReport?.total_records_analyzed || baseKpis.totalCases,
    highRegretPct: es?.high_regret_pct?.toString() || undefined,
    paymentRelatedPct: es?.payment_related_pct?.toString() || undefined,
    processedRecords: processingStats.processedRecords,
    topReasonPct: firstReason?.percentage?.toString() || undefined,
  } : null;

  const subtitle = isAudienceSurvey
    ? 'Marketing research insights from audience survey campaigns'
    : 'Member churn analysis from move-out survey campaigns';

  const handleDownloadReport = async () => {
    if (!reportData) return;
    toast.info('Generating Executive Brief...');
    try {
      await generateMoveOutDocx(reportData, selectedReport?.created_at, selectedReport?.id, selectedReport?.total_records_analyzed);
      toast.success('Report downloaded successfully');
    } catch (err) {
      console.error('Report generation error:', err);
      toast.error('Failed to generate report');
    }
  };

  const lastUpdated = selectedReport?.created_at
    ? format(new Date(selectedReport.created_at), 'MMM d, yyyy h:mm a')
    : null;

  return (
    <DashboardLayout title="" subtitle="">
      <div className="max-w-7xl mx-auto space-y-4">

      {/* ZONE 0 — Slim Dismissible Cost Alert (admin only) */}
      {isAdmin && !isAudienceSurvey && !isScriptView && (
        <CostAlertSlimBanner />
      )}

      {/* ZONE 1 — Compact Command Bar */}
      <div className="flex flex-wrap items-center gap-2 py-2">
        {/* Left: Title + processing status badge */}
        <div className="flex items-center gap-2 mr-auto">
          <h1 className="text-lg font-semibold text-foreground">Research Insights</h1>
          {!isAudienceSurvey && !isScriptView && (
            processingStats.pendingRecords > 0
              ? <Badge variant="outline" className="text-xs gap-1 border-amber-500/40 text-amber-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                  {processingStats.pendingRecords} pending
                </Badge>
              : <Badge variant="outline" className="text-xs gap-1 border-emerald-500/40 text-emerald-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  {processingStats.processedRecords} processed
                </Badge>
          )}
        </div>

        {/* Center: Campaign type + time filter */}
        <Select value={campaignType} onValueChange={handleCampaignTypeChange}>
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="move_out_survey">Move-Out Research</SelectItem>
            <SelectItem value="audience_survey">Audience Survey</SelectItem>
            {activeScripts.map(s => (
              <SelectItem key={s.id} value={`script:${s.id}`}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!isAudienceSurvey && !isScriptView && (
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRangeOption)}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
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
        )}

        {/* Right: Actions */}
        {isAdmin && !isAudienceSurvey && !isScriptView && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleManualRegenerate}
            disabled={isGenerating}
            title="Refresh report"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
          </Button>
        )}

        {isAdmin && reportData && !isAudienceSurvey && !isScriptView && (
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleDownloadReport}>
            <FileText className="w-3.5 h-3.5" />
            Word
          </Button>
        )}

        {!selectedReport && !isGenerating && !isAudienceSurvey && !isScriptView && (
          <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={handleGenerate} disabled={isGenerating}>
            <Sparkles className="w-3.5 h-3.5" />
            Generate
          </Button>
        )}

        {!isAudienceSurvey && !isScriptView && reports.length > 1 && (
          <Select value={selectedReport?.id || ''} onValueChange={(id) => fetchReportDetail(id)}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue placeholder="Snapshot" />
            </SelectTrigger>
            <SelectContent>
              {reports.filter(r => r.status === 'completed').map(r => (
                <SelectItem key={r.id} value={r.id}>
                  {r.created_at ? format(new Date(r.created_at), 'MMM d h:mm a') : r.id.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* In-progress banner */}
      {isGenerating && (
        <div className="rounded-lg p-4 space-y-2 border border-primary/20 bg-primary/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
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

      {/* No reports yet — only for move-out survey (audience survey uses live aggregation) */}
      {!isLoading && !selectedReport && !isGenerating && !isAudienceSurvey && !isScriptView && (
        <Card className="shadow-sm">
          <CardContent className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">No Insights Yet</h3>
            <p className="text-sm text-muted-foreground mb-3 max-w-md mx-auto">
              {processingStats.totalResearchRecords > 0
                ? `${processingStats.processedRecords} processed records. Click Generate to analyze.`
                : 'No research records yet.'}
            </p>
            {processingStats.totalResearchRecords > 0 && (
              <Button size="sm" onClick={handleGenerate} className="gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Generate
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Report content — SCRIPT INSIGHTS (dynamic per-script) */}
      {!isLoading && isScriptView && selectedScriptId && (
        <ScriptInsightsPanel scriptId={selectedScriptId} />
      )}

      {/* Report content — AUDIENCE SURVEY (live aggregation from raw data) */}
      {!isLoading && isAudienceSurvey && (
        <AudienceSurveyInsightsDashboard />
      )}

      {/* Report content — MOVE-OUT SURVEY */}
      {!isLoading && reportData && !isAudienceSurvey && !isScriptView && (selectedReport?.status === 'completed' || isGenerating) && (
        <div className="space-y-4">
          {/* KPI Grid (3×2) */}
          {kpis && <MoveOutKPIGrid kpis={kpis} />}

          {/* Tab Navigation */}
          <Tabs value={currentTab} onValueChange={setTab}>
            <TabsList className="w-full justify-start border-b border-border bg-transparent p-0 h-auto rounded-none">
              <TabsTrigger value="overview" className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5">
                <LayoutDashboard className="w-4 h-4" />
                <span className="hidden sm:inline">Overview</span>
              </TabsTrigger>
              <TabsTrigger value="issues" className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5">
                <SearchCode className="w-4 h-4" />
                <span className="hidden sm:inline">Issues & Root Causes</span>
                {processingStats.humanReviewCount > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5 ml-1">{processingStats.humanReviewCount}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="operations" className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5">
                <Settings2 className="w-4 h-4" />
                <span className="hidden sm:inline">Operations</span>
              </TabsTrigger>
              <TabsTrigger value="members" className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Member Data</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              <MoveOutOverview
                reportData={reportData}
                kpis={kpis!}
                lastUpdated={lastUpdated}
                totalRecords={kpis?.totalCases || 0}
                onCodeClick={(code) => setDrillDownCode(code)}
                onViewAllMembers={() => setTab('members')}
              />
            </TabsContent>

            <TabsContent value="issues" className="space-y-4 mt-4">
              <MoveOutIssuesTab reportData={reportData} />
            </TabsContent>

            <TabsContent value="operations" className="space-y-4 mt-4">
              <MoveOutOperationsTab reportData={reportData} />
            </TabsContent>

            <TabsContent value="members" className="space-y-4 mt-4">
              <MoveOutMemberTab isAdmin={isAdmin} />
            </TabsContent>
          </Tabs>

          {/* Human Review Queue (collapsed by default) */}
          <div className="pt-2">
            <Collapsible open={reviewOpen} onOpenChange={setReviewOpen}>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-medium text-foreground">Human Review Queue</span>
                    {processingStats.humanReviewCount > 0 && (
                      <Badge variant="secondary" className="text-xs">{processingStats.humanReviewCount}</Badge>
                    )}
                  </div>
                  <ChevronDown className={`w-4 h-4 transition-transform ${reviewOpen ? 'rotate-180' : ''}`} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <HumanReviewQueue onExportModal={isAdmin ? openExportModal : undefined} />
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      )}

      </div>{/* end max-w-7xl wrapper */}

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

      {/* Drill-down modal for reason codes (move-out only) */}
      {!isAudienceSurvey && !isScriptView && (
        <ReasonCodeDrillDown
          open={!!drillDownCode}
          onOpenChange={(open) => { if (!open) setDrillDownCode(null); }}
          reasonCode={drillDownCode || ''}
          reasonColor="hsl(var(--primary))"
        />
      )}

      <ExportMembersModal
        open={exportModalOpen}
        onOpenChange={setExportModalOpen}
        filter={exportFilter}
        title={exportTitle}
        defaultFilename={exportFilename}
      />

      {/* Regeneration confirmation dialog */}
      <AlertDialog open={showRegenConfirm} onOpenChange={setShowRegenConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate Report?</AlertDialogTitle>
            <AlertDialogDescription>
              This will regenerate the report from all current data. This may take a few minutes. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRegenerate}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

/** Slim dismissible cost alert banner */
function CostAlertSlimBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { alertLevel, rollingAvg, threshold } = useCostAlertMonitor();

  if (dismissed || alertLevel === 'normal') return null;

  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-2 rounded-lg text-xs ${
      alertLevel === 'critical'
        ? 'bg-destructive/10 border border-destructive/30 text-destructive'
        : 'bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400'
    }`}>
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
        <span>
          Cost {alertLevel === 'critical' ? 'ceiling breach' : 'warning'}: ${rollingAvg.toFixed(4)}/record avg vs ${threshold.toFixed(2)} threshold
        </span>
      </div>
      <button onClick={() => setDismissed(true)} className="text-current hover:opacity-70 font-bold px-1">×</button>
    </div>
  );
}
