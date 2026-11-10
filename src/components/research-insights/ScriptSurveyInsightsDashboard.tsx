// CR-010 Phase 2: Payment-Experience-style dashboard for per-script surveys
// (30-Day Member Experience, Non-Booking Conversion). Built on the Phase 1
// data layer; reuses PE visuals where generic, generic twins otherwise.
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSessionState } from '@/hooks/useSessionState';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { DateRangeOption } from '@/hooks/useResearchInsightsData';
import { useScriptSurveyResponses, type ScriptSurveyQuestion, type ScriptSurveyRecord } from '@/hooks/useScriptSurveyResponses';
import {
  computeScriptSurveyFunnel,
  deriveScriptSurveyStats,
  filterByDateRange,
  summarizeScriptQuestion,
} from '@/utils/scriptSurveyAnalytics';
import { SCRIPT_SURVEY_KPIS, computeScriptKpis, formatKpiValue, kpiDenominator } from '@/config/scriptSurveyKpis';
import { generateScriptSurveyDocx } from '@/utils/generate-script-survey-docx';
import { toPEQuestionSummary } from '@/utils/scriptSurveyPEAdapter';
import { KPI } from '@/components/payment-experience/insights/primitives/KpiTile';
import { SectionHeader } from '@/components/payment-experience/insights/primitives/SectionHeader';
import { TopicQuestionCard } from '@/components/payment-experience/insights/TopicQuestionCard';
import { OpenEndedClusters } from '@/components/payment-experience/insights/OpenEndedClusters';
import { ScriptSurveySummaryBanner } from './script-survey/ScriptSurveySummaryBanner';
import { ScriptSurveyFunnelSection } from './script-survey/ScriptSurveyFunnelSection';
import { ScriptSurveyTabs, type ScriptSurveyTab } from './script-survey/ScriptSurveyTabs';
import { ScriptSurveyResponsesTab } from './script-survey/ScriptSurveyResponsesTab';
import { ScriptSubmissionsTab, ScriptAISummaryTab } from './ScriptInsightsPanel';
import { ScriptGridCard } from './ScriptGridCard';
import { RespondentsSheet, type RespondentsSelection } from './script-survey/RespondentsSheet';
import { respondentsForChoice, respondentsForGridCell, respondentsForScale } from '@/utils/scriptSurveyRespondents';
import { groupSurveyBlocks, type SurveyBlock } from '@/utils/scriptSurveyGrid';

const shortLabel = (s: string) => (s.length > 28 ? s.slice(0, 27) + '…' : s);

function QuestionTopicCard({ scriptId, q, eligible, onSelect }: { scriptId: string; q: ScriptSurveyQuestion; eligible: ScriptSurveyRecord[]; onSelect?: (s: RespondentsSelection) => void }) {
  const summary = useMemo(() => summarizeScriptQuestion(q, eligible), [q, eligible]);
  // CR-018: same normalization as the counts; merged chart rows union their source labels.
  const onItemClick = onSelect && summary.type !== 'open_ended'
    ? (item: { label: string }) => {
        if (summary.type === 'scale') {
          onSelect({ title: item.label, question: q.question, records: respondentsForScale(q, eligible, Number(item.label)) });
          return;
        }
        const want = item.label.trim().toLowerCase();
        const labels = summary.distribution.map((d) => d.label).filter((l) => l.trim().toLowerCase() === want);
        const seen = new Map<string, ScriptSurveyRecord>();
        for (const l of labels.length ? labels : [item.label]) for (const r of respondentsForChoice(q, eligible, l)) seen.set(r.booking_id, r);
        const records = Array.from(seen.values()).sort((a, b) => (a.booking_date === b.booking_date ? (a.booking_id < b.booking_id ? 1 : -1) : a.booking_date < b.booking_date ? 1 : -1));
        onSelect({ title: item.label, question: q.question, records });
      }
    : undefined;
  if (summary.type === 'open_ended') {
    return (
      <Card>
        <CardContent className="p-5 space-y-3">
          <p className="text-sm font-medium text-foreground leading-snug">{q.question}</p>
          <OpenEndedClusters
            questionId={`${scriptId}:${q.id}`}
            questionText={q.question}
            responses={summary.allResponses}
            sampleResponses={summary.samples}
            totalResponses={summary.count}
          />
        </CardContent>
      </Card>
    );
  }
  const pe = toPEQuestionSummary(q, summary);
  if (summary.type === 'scale') {
    return (
      <TopicQuestionCard
        summary={pe}
        title={q.question}
        chart="bars"
        fixedOrder={pe.distribution.map((d) => d.key)}
        helperText={summary.avg != null ? `Average ${summary.avg.toFixed(1)} · ${summary.count} responses` : undefined}
        onItemClick={onItemClick}
      />
    );
  }
  if (summary.type === 'multiple_select') {
    return (
      <TopicQuestionCard
        summary={pe}
        title={q.question}
        chart="bars"
        helperText="Multiple answers allowed — % of respondents"
        onItemClick={onItemClick}
      />
    );
  }
  return <TopicQuestionCard summary={pe} title={q.question} chart="donut" onItemClick={onItemClick} />;
}

// Overview keeps KPI order; a KPI question that sits in a grid shows its whole grid once.
function overviewBlocks(picked: ScriptSurveyQuestion[], all: ScriptSurveyQuestion[]): SurveyBlock[] {
  const blocks = groupSurveyBlocks(all);
  const out: SurveyBlock[] = [];
  const seen = new Set<SurveyBlock>();
  for (const q of picked) {
    const b = blocks.find((x) => x.kind === 'grid' && x.rows.some((r) => r.id === q.id));
    if (b) { if (!seen.has(b)) { seen.add(b); out.push(b); } }
    else out.push({ kind: 'single', q });
  }
  return out;
}

export function ScriptSurveyInsightsDashboard({ scriptId }: { scriptId: string }) {
  const { user } = useAuth();
  const canSeeSubmissions = user?.role === 'super_admin' || user?.role === 'admin';
  const canSeeAISummary = canSeeSubmissions || user?.role === 'supervisor';
  const [dateRange, setDateRange] = useSessionState<DateRangeOption>(`scriptSurvey:${scriptId}:dateRange`, 'allTime');
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [respSel, setRespSel] = useState<RespondentsSelection | null>(null);

  const { script, questions, sections, records: allRecords, validRecords: allValid, eligibleRecords: allEligible, campaigns, campaignIdsReadable, lists, isLoading } =
    useScriptSurveyResponses(scriptId);

  // CR-014: campaign filter (AND with date range). Unknown id → All.
  const showCampaignFilter = campaignIdsReadable && campaigns.length >= 2;
  const campParam = searchParams.get('camp');
  const selectedCampaign = showCampaignFilter ? campaigns.find((c) => c.id === campParam) ?? null : null;
  // CR-017: list filter (AND with campaign + date). Unknown/not-offered value → All.
  const showListFilter = lists.length >= 1;
  const offeredLists = selectedCampaign ? lists.filter((l) => l.campaign_id === selectedCampaign.id) : lists;
  const listParam = searchParams.get('list');
  const listNone = showListFilter && listParam === 'none';
  const selectedList = showListFilter && !listNone ? offeredLists.find((l) => l.list_id === listParam) ?? null : null;
  const listKey = listNone ? 'none' : selectedList?.list_id ?? 'all';
  const setCampaign = (v: string) => {
    const next = new URLSearchParams(searchParams);
    if (v === 'all') next.delete('camp'); else next.set('camp', v);
    const lp = next.get('list');
    if (lp && lp !== 'none' && v !== 'all' && !lists.some((l) => l.list_id === lp && l.campaign_id === v)) next.delete('list');
    setSearchParams(next, { replace: true });
  };
  const setList = (v: string) => {
    const next = new URLSearchParams(searchParams);
    if (v === 'all') next.delete('list'); else next.set('list', v);
    setSearchParams(next, { replace: true });
  };
  const byCampaign = (rs: ScriptSurveyRecord[]) =>
    selectedCampaign ? rs.filter((r) => r.campaign_id === selectedCampaign.id) : rs;
  const byFilters = (rs: ScriptSurveyRecord[]) => {
    const c = byCampaign(rs);
    if (listNone) return c.filter((r) => !r.list_id);
    if (selectedList) return c.filter((r) => r.list_id === selectedList.list_id);
    return c;
  };

  const datedRecords = useMemo(() => filterByDateRange(allRecords, dateRange), [allRecords, dateRange]);
  const records = useMemo(() => byFilters(datedRecords), [datedRecords, selectedCampaign, listKey]);
  const validRecords = useMemo(() => byFilters(filterByDateRange(allValid, dateRange)), [allValid, dateRange, selectedCampaign, listKey]);
  const eligible = useMemo(() => byFilters(filterByDateRange(allEligible, dateRange)), [allEligible, dateRange, selectedCampaign, listKey]);
  const nullCampaignCount = selectedCampaign ? datedRecords.filter((r) => !r.campaign_id).length : 0;
  const { unnamedListCount, noListCount } = useMemo(() => {
    if (!showListFilter) return { unnamedListCount: 0, noListCount: 0 };
    const named = new Set(lists.map((l) => l.list_id));
    let unnamed = 0, none = 0;
    for (const r of byCampaign(datedRecords)) {
      if (!r.list_id) none++; else if (!named.has(r.list_id)) unnamed++;
    }
    return { unnamedListCount: unnamed, noListCount: none };
  }, [showListFilter, lists, datedRecords, selectedCampaign]);

  const campaignType = script?.campaignType ?? '';
  const { data: report } = useQuery({
    queryKey: ['script-survey-report', campaignType],
    enabled: !!campaignType,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('research_insights')
        .select('data, generated_at, total_records_analyzed')
        .eq('campaign_type', campaignType)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as { data: any; generated_at: string | null; total_records_analyzed: number | null } | null;
    },
  });

  const kpiConfig = SCRIPT_SURVEY_KPIS[scriptId] || [];
  const kpis = useMemo(
    () => computeScriptKpis(kpiConfig, questions, eligible, records.length),
    [kpiConfig, questions, eligible, records.length],
  );
  const stats = useMemo(() => deriveScriptSurveyStats(questions, eligible), [questions, eligible]);
  const funnel = useMemo(
    () => computeScriptSurveyFunnel(records, validRecords, eligible, questions),
    [records, validRecords, eligible, questions],
  );

  const summaryText: string = report?.data?.report?.executive_summary || '';
  const firstAction: string | null = report?.data?.report?.recommendations?.[0]?.action || null;
  const derivedSummary = useMemo(() => {
    let lowest: { label: string; value: number } | null = null;
    kpiConfig.forEach((k, i) => {
      const v = kpis[i]?.value;
      if (k.kind === 'avg' && v != null && (!lowest || v < lowest.value)) lowest = { label: k.label, value: v };
    });
    const l = lowest as { label: string; value: number } | null;
    return `${stats.respondents} members surveyed · ${Math.round(stats.completionRate)}% avg completion` +
      (l ? ` · lowest-scoring: ${l.label} (${l.value.toFixed(1)}/5)` : '');
  }, [kpiConfig, kpis, stats]);

  const handleWord = async () => {
    if (!script || isGenerating || eligible.length === 0) return;
    setIsGenerating(true);
    toast.info('Generating clusters and narrative — this can take ~1–2 minutes…');
    try {
      await generateScriptSurveyDocx({
        scriptId,
        scriptName: script.name,
        questions,
        sections,
        records,
        validRecords,
        eligibleRecords: eligible,
        kpiConfig,
        kpis,
        campaignName: selectedCampaign?.name,
        listName: listNone ? 'No list' : selectedList?.name,
      });
      toast.success('Executive brief downloaded');
    } catch (err) {
      console.error('[ScriptSurveyInsights] Word brief failed', err);
      toast.error('Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  if (allRecords.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          No survey calls processed yet.
        </CardContent>
      </Card>
    );
  }

  const overviewQuestions = kpiConfig
    .slice(1)
    .map((k) => questions.find((q) => q.ai_extraction_hint === k.hint))
    .filter((q): q is ScriptSurveyQuestion => !!q);

  const forms = eligible.filter((r) => r.isForm).length;
  const nonZeroSteps = funnel.filter((s) => s.count > 0).length;

  const onGridCell = (b: Extract<SurveyBlock, { kind: 'grid' }>) => (rowId: string, column: string) => {
    const rowQ = b.rows.find((r) => r.id === rowId);
    if (!rowQ) return;
    setRespSel({ title: `${rowQ.matrix?.row || rowQ.question} — ${column}`, question: b.title, records: respondentsForGridCell(rowQ, eligible, column) });
  };
  const renderBlock = (b: SurveyBlock) => b.kind === 'grid'
    ? <ScriptGridCard key={`grid-${b.group}-${b.rows[0].id}`} block={b} eligible={eligible} onCellClick={onGridCell(b)} />
    : <QuestionTopicCard key={b.q.id} scriptId={scriptId} q={b.q} eligible={eligible} onSelect={setRespSel} />;

  const tabs: ScriptSurveyTab[] = [
    {
      key: 'overview',
      label: 'Overview',
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {overviewBlocks(overviewQuestions, questions).map((b) => renderBlock(b))}
        </div>
      ),
    },
    ...sections.map((sec, i) => ({
      key: `section-${i}`,
      label: shortLabel(sec),
      title: sec,
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {groupSurveyBlocks(questions.filter((q) => q.section === sec)).map((b) => renderBlock(b))}
        </div>
      ),
    })),
    {
      key: 'script-responses',
      label: 'Script Responses',
      badge: eligible.length,
      content: (
        <ScriptSurveyResponsesTab
          scriptId={scriptId}
          scriptName={script?.name ?? 'Survey'}
          questions={questions}
          eligibleRecords={eligible}
        />
      ),
    },
    ...(canSeeSubmissions
      ? [{ key: 'submissions', label: 'Submissions', content: <ScriptSubmissionsTab scriptId={scriptId} /> }]
      : []),
    ...(canSeeAISummary && campaignType
      ? [{
          key: 'ai-summary',
          label: 'AI Summary',
          content: <ScriptAISummaryTab scriptId={scriptId} campaignType={campaignType} canGenerate={canSeeSubmissions} />,
        }]
      : []),
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        {showCampaignFilter && (
          <Select value={selectedCampaign?.id ?? 'all'} onValueChange={setCampaign}>
            <SelectTrigger className="w-[260px] h-8 text-xs" aria-label="Campaign">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All campaigns</SelectItem>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {showListFilter && (
          <Select value={listKey} onValueChange={setList}>
            <SelectTrigger className="w-[220px] h-8 text-xs" aria-label="List">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All lists</SelectItem>
              {offeredLists.map((l) => (
                <SelectItem key={l.list_id} value={l.list_id}>{l.name}</SelectItem>
              ))}
              <SelectItem value="none">No list</SelectItem>
            </SelectContent>
          </Select>
        )}
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
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={handleWord}
          disabled={isGenerating || eligible.length === 0}
        >
          {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
          {isGenerating ? 'Generating…' : 'Word'}
        </Button>
      </div>

      <ScriptSurveySummaryBanner
        summary={summaryText || derivedSummary}
        source={summaryText ? 'ai' : 'derived'}
        firstAction={summaryText ? firstAction : null}
        footer={summaryText && report?.total_records_analyzed != null
          ? `Based on ${report.total_records_analyzed.toLocaleString()} analyzed records`
          : null}
      />
      {selectedCampaign && (
        <div className="space-y-0.5 text-xs text-muted-foreground">
          <p>AI summary covers all campaigns of this script</p>
          {nullCampaignCount > 0 && (
            <p>{nullCampaignCount.toLocaleString()} calls without a campaign are only included in All campaigns</p>
          )}
        </div>
      )}


      {showListFilter && (unnamedListCount > 0 || noListCount > 0) && (
        <div className="space-y-0.5 text-xs text-muted-foreground">
          {unnamedListCount > 0 && <p>{unnamedListCount.toLocaleString()} calls come from lists without a name</p>}
          {noListCount > 0 && <p>{noListCount.toLocaleString()} calls arrived without a list (the dialer did not send it)</p>}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {kpiConfig.map((k, i) => {
          const r = kpis[i];
          const Icon = k.icon;
          return (
            <KPI
              key={k.label}
              label={k.label}
              value={formatKpiValue(k, r)}
              denominator={kpiDenominator(k, r)}
              icon={<Icon className="h-4 w-4" />}
              iconBg={k.iconBg}
              iconColor={k.iconColor}
              variant={k.variant}
              accent={k.accent}
            />
          );
        })}
      </div>

      {nonZeroSteps >= 2 && (
        <div className="space-y-2">
          <SectionHeader title="Survey Funnel" />
          <ScriptSurveyFunnelSection
            steps={funnel}
            detail={`${validRecords.length.toLocaleString()} valid conversations of ${records.length.toLocaleString()} routed · ${forms} with typed form · ${eligible.length - forms} recording-only`}
          />
        </div>
      )}

      <ScriptSurveyTabs tabs={tabs} />
      <RespondentsSheet
        selection={respSel}
        onClose={() => setRespSel(null)}
        campaignName={showCampaignFilter ? (id) => campaigns.find((c) => c.id === id)?.name ?? null : undefined}
        listName={showListFilter ? (id) => (id ? lists.find((l) => l.list_id === id)?.name ?? null : null) : undefined}
      />
    </div>
  );
}
