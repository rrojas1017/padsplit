import { forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import { useSessionState } from '@/hooks/useSessionState';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Users, BookOpen, Repeat, FileQuestion, ShieldAlert, CalendarClock, FileText, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { generatePEDocx } from '@/utils/generate-pe-docx';
import type { DateRangeOption } from '@/hooks/useResearchInsightsData';

export function filterByDateRange<T extends { booking_date: string }>(records: T[], range: DateRangeOption): T[] {
  if (range === 'allTime') return records;
  const now = new Date();
  let start: Date;
  let end: Date | null = null;
  if (range === 'thisWeek') {
    const day = now.getDay(); // 0 = Sun
    start = new Date(now); start.setDate(now.getDate() - day); start.setHours(0,0,0,0);
  } else if (range === 'thisMonth') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (range === 'lastMonth') {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 1);
  } else { // last3months
    start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  }
  // booking_date is a 'yyyy-MM-dd' ET string: compare strings against local
  // 'yyyy-MM-dd' bounds (start inclusive, end exclusive) — never parse it.
  const ymd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const startKey = ymd(start);
  const endKey = end ? ymd(end) : null;
  return records.filter((r) => {
    const d = typeof r.booking_date === 'string' ? r.booking_date.slice(0, 10) : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
    if (d < startKey) return false;
    if (endKey && d >= endKey) return false;
    return true;
  });
}

import {
  usePaymentExperienceResponses,
  deriveKPIs,
  computeEligibilityStats,
  aggregateFrictionThemes,
  aggregateAutopayBarriers,
  type KPIMetric,
} from '@/hooks/usePaymentExperienceResponses';
import { usePaymentExperienceAIInsight } from '@/hooks/usePaymentExperienceAIInsight';
import {
  computeSegmentedInsights,
  computeKeyDrivers,
  computeEmergingRisks,
  computeSuggestedActions,
  computeSurveyFunnel,
  computeKpiCaptions,
} from '@/utils/paymentExperienceAnalytics';
import { SectionHeader } from './insights/primitives/SectionHeader';
import { ExecutiveSummaryBanner } from './insights/ExecutiveSummaryBanner';
import { SurveyFunnelSection } from './insights/SurveyFunnelSection';
import { InsightTabs } from './insights/InsightTabs';

// ── KPI tile ────────────────────────────────────────────────────────────────

import { KPI } from './insights/primitives/KpiTile';

// ── Formatters ──────────────────────────────────────────────────────────────

const fmtPct = (m: KPIMetric) => (m.value == null ? '—' : `${Math.round(m.value)}%`);
const fmtScore = (m: KPIMetric, max: number) =>
  m.value == null ? '—' : `${m.value.toFixed(1)}/${max}`;

// ── Dashboard ───────────────────────────────────────────────────────────────

export interface PaymentExperienceDashboardHandle {
  downloadReport: () => Promise<void>;
  isGenerating: boolean;
  hasEligible: boolean;
}

interface PaymentExperienceDashboardProps {
  dateRange?: DateRangeOption;
  hideHeader?: boolean;
  onGeneratingChange?: (g: boolean) => void;
}

export const PaymentExperienceInsightsDashboard = forwardRef<
  PaymentExperienceDashboardHandle,
  PaymentExperienceDashboardProps
>(function PaymentExperienceInsightsDashboard(
  { dateRange: dateRangeProp, hideHeader, onGeneratingChange },
  ref,
) {
  const {
    records: allRecords, eligibleRecords: allEligible, eligibilityStats,
    topFrictionThemes: allFrictionThemes,
    autopayBarriers: allBarriers, isLoading,
  } = usePaymentExperienceResponses();

  const [internalDateRange, setInternalDateRange] = useSessionState<DateRangeOption>('paymentExperience:dateRange', 'allTime');
  const dateRange = dateRangeProp ?? internalDateRange;
  const setDateRange = (v: DateRangeOption) => setInternalDateRange(v);

  // Apply time filter to all derived datasets
  const records = useMemo(() => filterByDateRange(allRecords, dateRange), [allRecords, dateRange]);
  const eligibleRecords = useMemo(() => filterByDateRange(allEligible, dateRange), [allEligible, dateRange]);

  // Recompute KPIs and aggregates from the date-filtered eligible set
  const { kpis, topFrictionThemes, autopayBarriers } = useMemo(() => ({
    kpis: { ...deriveKPIs(eligibleRecords), totalRouted: records.length },
    topFrictionThemes: aggregateFrictionThemes(eligibleRecords).themes,
    autopayBarriers: aggregateAutopayBarriers(eligibleRecords),
  }), [eligibleRecords, records]);

  // Banner + funnel footer use the date-filtered, corrected values.
  const frictionSummary = useMemo(() => aggregateFrictionThemes(eligibleRecords).summary, [eligibleRecords]);
  const filteredEligibility = useMemo(() => computeEligibilityStats(records), [records]);
  const { insight } = usePaymentExperienceAIInsight({
    kpis,
    topFriction: topFrictionThemes,
    topBarriers: autopayBarriers,
  });

  const analytics = useMemo(() => ({
    segmentedInsights: computeSegmentedInsights(eligibleRecords),
    keyDrivers: computeKeyDrivers(eligibleRecords),
    emergingRisks: computeEmergingRisks(eligibleRecords),
    suggestedActions: computeSuggestedActions(eligibleRecords),
    surveyFunnel: computeSurveyFunnel(records, eligibleRecords),
    kpiCaptions: computeKpiCaptions(eligibleRecords),
  }), [records, eligibleRecords]);

  const [isGenerating, setIsGenerating] = useState(false);
  const handleDownloadReport = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    onGeneratingChange?.(true);
    try {
      toast.info('Generating clusters and narrative — this can take ~1–2 minutes…');
      await generatePEDocx(records, eligibleRecords, kpis, topFrictionThemes, autopayBarriers);
      toast.success('Executive brief downloaded');
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate report');
    } finally {
      setIsGenerating(false);
      onGeneratingChange?.(false);
    }
  };

  useImperativeHandle(ref, () => ({
    downloadReport: handleDownloadReport,
    isGenerating,
    hasEligible: eligibleRecords.length > 0,
  }), [isGenerating, eligibleRecords.length, records, kpis, topFrictionThemes, autopayBarriers]);




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
          No Payment Experience survey calls processed yet.
        </CardContent>
      </Card>
    );
  }

  const routedTotal = filteredEligibility.eligible + filteredEligibility.excluded;

  return (
    <div className="space-y-3">
      {!hideHeader && (
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
            onClick={handleDownloadReport}
            disabled={isGenerating || eligibleRecords.length === 0}
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
          >
            {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            {isGenerating ? 'Generating…' : 'Word'}
          </Button>
        </div>
      )}

      <ExecutiveSummaryBanner
        insight={insight}
        kpis={kpis}
        topFrictionThemes={topFrictionThemes}
        firstAction={analytics.suggestedActions[0]}
      />



      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <KPI
          label="Members Surveyed"
          value={eligibleRecords.length.toLocaleString()}
          denominator={`${eligibleRecords.length.toLocaleString()} eligible of ${records.length.toLocaleString()} routed`}
          icon={<Users className="h-4 w-4" />}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />

        <KPI
          label="Avg Payment Literacy"
          value={fmtScore(kpis.literacy, 100)}
          denominator={`Based on ${kpis.literacy.numerator.toLocaleString()} responses`}
          icon={<BookOpen className="h-4 w-4" />}
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
        />
        <KPI
          label="Auto-pay Enrolled"
          value={fmtPct(kpis.autopayEnrolled)}
          denominator={`${kpis.autopayEnrolled.numerator.toLocaleString()} enrolled members`}
          caption={analytics.kpiCaptions.autopay}
          icon={<Repeat className="h-4 w-4" />}
          iconBg="bg-green-50 dark:bg-green-950/20"
          iconColor="text-green-600"
          variant="primary"
          accent="green"
        />
        <KPI
          label="Move-in Cost Clarity"
          value={fmtScore(kpis.moveInClarity, 5)}
          denominator={`${kpis.moveInClarity.numerator.toLocaleString()} member ratings`}
          icon={<FileQuestion className="h-4 w-4" />}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
        <KPI
          label="Hardship-Aware"
          value={fmtPct(kpis.hardshipAware)}
          denominator={`${kpis.hardshipAware.numerator.toLocaleString()} of ${kpis.hardshipAware.denominator.toLocaleString()} aware`}
          caption={analytics.kpiCaptions.hardship}
          icon={<ShieldAlert className="h-4 w-4" />}
          iconBg="bg-rose-50"
          iconColor="text-rose-600"
        />
        <KPI
          label="Pay-cycle Misalignment"
          value={fmtPct(kpis.payCycleMisalignment)}
          denominator={`${kpis.payCycleMisalignment.numerator.toLocaleString()} non-weekly schedules`}
          caption={analytics.kpiCaptions.payCycle}
          icon={<CalendarClock className="h-4 w-4" />}
          iconBg="bg-orange-50 dark:bg-orange-950/20"
          iconColor="text-orange-600"
          variant="primary"
          accent="orange"
        />
      </div>

      {analytics.surveyFunnel.length >= 2 && (
        <>
          <SectionHeader title="Survey Funnel" />
          <SurveyFunnelSection
            steps={analytics.surveyFunnel}
            eligibility={{
              eligible: filteredEligibility.eligible,
              routedTotal,
              excluded: filteredEligibility.excluded,
              voicemail: filteredEligibility.voicemail,
              tooShort: filteredEligibility.tooShort,
              insufficientExtraction: filteredEligibility.insufficientExtraction,
            }}
          />
        </>
      )}

      <InsightTabs
        kpis={kpis}
        topFrictionThemes={topFrictionThemes}
        frictionSummary={frictionSummary}
        autopayBarriers={autopayBarriers}
        emergingRisks={analytics.emergingRisks}
        keyDrivers={analytics.keyDrivers}
        segments={analytics.segmentedInsights}
        suggestedActions={analytics.suggestedActions}
        records={records}
        eligibleRecords={eligibleRecords}
      />
    </div>
  );
});
