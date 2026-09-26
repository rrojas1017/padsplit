// CR-010 Phase 2: Payment-Experience-style dashboard for per-script surveys
// (30-Day Member Experience, Non-Booking Conversion). Built on the Phase 1
// data layer; reuses PE visuals where generic, generic twins otherwise.
import { useMemo, useState } from 'react';
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
import type { ScriptQuestion } from '@/hooks/useResearchScripts';
import { useScriptSurveyResponses, type ScriptSurveyQuestion, type ScriptSurveyRecord } from '@/hooks/useScriptSurveyResponses';
import {
  computeScriptSurveyFunnel,
  deriveScriptSurveyStats,
  filterByDateRange,
  summarizeScriptQuestion,
  answerLabels,
  answerScale,
  answerText,
} from '@/utils/scriptSurveyAnalytics';
import { SCRIPT_SURVEY_KPIS, computeScriptKpis, type ScriptKpiConfig, type ScriptKpiResult } from '@/config/scriptSurveyKpis';
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

function formatKpiValue(k: ScriptKpiConfig, r: ScriptKpiResult): string {
  if (r.value == null) return '—';
  if (k.kind === 'avg') return `${r.value.toFixed(1)}/${k.max ?? 5}`;
  if (k.kind === 'pct') return `${Math.round(r.value)}%`;
  return r.value.toLocaleString();
}

function kpiDenominator(k: ScriptKpiConfig, r: ScriptKpiResult): string {
  if (k.kind === 'count') return `${r.numerator.toLocaleString()} with answers of ${r.denominator.toLocaleString()} routed`;
  if (k.kind === 'avg') return `Based on ${r.numerator.toLocaleString()} responses`;
  return `${r.numerator.toLocaleString()} of ${r.denominator.toLocaleString()} answered`;
}

const shortLabel = (s: string) => (s.length > 28 ? s.slice(0, 27) + '…' : s);

function QuestionTopicCard({ scriptId, q, eligible }: { scriptId: string; q: ScriptSurveyQuestion; eligible: ScriptSurveyRecord[] }) {
  const summary = useMemo(() => summarizeScriptQuestion(q, eligible), [q, eligible]);
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
      />
    );
  }
  return <TopicQuestionCard summary={pe} title={q.question} chart="donut" />;
}

export function ScriptSurveyInsightsDashboard({ scriptId }: { scriptId: string }) {
  const { user } = useAuth();
  const canSeeSubmissions = user?.role === 'super_admin' || user?.role === 'admin';
  const canSeeAISummary = canSeeSubmissions || user?.role === 'supervisor';
  const [dateRange, setDateRange] = useSessionState<DateRangeOption>(`scriptSurvey:${scriptId}:dateRange`, 'allTime');
  const [isGenerating, setIsGenerating] = useState(false);

  const { script, questions, sections, records: allRecords, validRecords: allValid, eligibleRecords: allEligible, isLoading } =
    useScriptSurveyResponses(scriptId);

  const records = useMemo(() => filterByDateRange(allRecords, dateRange), [allRecords, dateRange]);
  const validRecords = useMemo(() => filterByDateRange(allValid, dateRange), [allValid, dateRange]);
  const eligible = useMemo(() => filterByDateRange(allEligible, dateRange), [allEligible, dateRange]);

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
    if (!script || isGenerating) return;
    setIsGenerating(true);
    try {
      const responses: Array<{ question_order: number; response_value: string | null; response_options: string[] | null; response_numeric: number | null; session_id: string }> = [];
      for (const r of eligible) {
        for (const q of questions) {
          const e = r.answers[q.id];
          const labels = answerLabels(e);
          const scale = answerScale(e);
          const text = answerText(e);
          if (!labels.length && scale === null && !text) continue;
          responses.push({
            question_order: q.order,
            response_value: text ?? (labels.length ? labels.join(', ') : scale !== null ? String(scale) : null),
            response_options: labels.length ? labels : null,
            response_numeric: scale,
            session_id: r.booking_id,
          });
        }
      }
      const { generateDynamicReport } = await import('@/utils/generateDynamicReport');
      await generateDynamicReport(
        { name: script.name, script_type: 'mixed' },
        questions.map((q) => ({ ...q, required: false })) as ScriptQuestion[],
        responses,
        eligible.length,
      );
    } catch (err) {
      console.error('[ScriptSurveyInsights] Word report failed', err);
      toast.error('Could not generate the Word report.');
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

  const tabs: ScriptSurveyTab[] = [
    {
      key: 'overview',
      label: 'Overview',
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {overviewQuestions.map((q) => (
            <QuestionTopicCard key={q.id} scriptId={scriptId} q={q} eligible={eligible} />
          ))}
        </div>
      ),
    },
    ...sections.map((sec, i) => ({
      key: `section-${i}`,
      label: shortLabel(sec),
      title: sec,
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {questions.filter((q) => q.section === sec).map((q) => (
            <QuestionTopicCard key={q.id} scriptId={scriptId} q={q} eligible={eligible} />
          ))}
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
    </div>
  );
}
