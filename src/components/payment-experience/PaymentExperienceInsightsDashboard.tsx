import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Users, BookOpen, Repeat, FileQuestion, ShieldAlert, CalendarClock, FileText, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { generatePEDocx } from '@/utils/generate-pe-docx';

import {
  usePaymentExperienceResponses,
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

interface KPIProps {
  label: string;
  value: string;
  denominator?: string;
  meta?: string;
  caption?: string;
  icon: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
  variant?: 'default' | 'primary';
  accent?: 'green' | 'orange';
}

function KPI({
  label, value, denominator, meta, caption, icon, iconBg, iconColor,
  variant = 'default', accent,
}: KPIProps) {
  const isPrimary = variant === 'primary';
  const accentBar =
    accent === 'green' ? 'before:bg-green-500/60'
    : accent === 'orange' ? 'before:bg-orange-500/60'
    : '';

  return (
    <Card
      className={cn(
        'h-full',
        isPrimary && 'relative overflow-hidden border-slate-300/80 dark:border-slate-700 before:absolute before:top-0 before:left-0 before:right-0 before:h-[2px] before:rounded-t-xl',
        isPrimary && accentBar,
      )}
    >
      <CardContent className="p-4 h-full flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0 flex-1">
            <p
              className={cn(
                'text-[13px] font-medium tracking-wide',
                isPrimary ? 'text-foreground/80' : 'text-muted-foreground uppercase',
              )}
            >
              {label}
            </p>
            <p
              className={cn(
                'font-bold tracking-tight text-foreground leading-none',
                isPrimary ? 'text-4xl md:text-[3rem] md:leading-none' : 'text-4xl',
              )}
            >
              {value}
            </p>
          </div>
          <div
            className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
              iconBg ?? 'bg-muted',
              iconColor ?? 'text-muted-foreground',
            )}
          >
            {icon}
          </div>
        </div>
        <div className="mt-auto pt-3 min-h-[40px] space-y-0.5">
          {denominator && (
            <p className="text-[11px] text-muted-foreground leading-snug break-words">{denominator}</p>
          )}
          {meta && (
            <p className="text-[11px] text-muted-foreground/70 leading-snug break-words">{meta}</p>
          )}
          {caption && (
            <p
              className={cn(
                'leading-snug break-words italic',
                isPrimary ? 'text-[12px] text-muted-foreground/90' : 'text-[11px] text-muted-foreground/70',
              )}
            >
              {caption}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Formatters ──────────────────────────────────────────────────────────────

const fmtPct = (m: KPIMetric) => (m.value == null ? '—' : `${Math.round(m.value)}%`);
const fmtScore = (m: KPIMetric, max: number) =>
  m.value == null ? '—' : `${m.value.toFixed(1)}/${max}`;

// ── Dashboard ───────────────────────────────────────────────────────────────

export function PaymentExperienceInsightsDashboard() {
  const {
    records, eligibleRecords, kpis, eligibilityStats,
    topFrictionThemes, frictionSummary, autopayBarriers, isLoading,
  } = usePaymentExperienceResponses();
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

  if (records.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          No Payment Experience survey calls processed yet.
        </CardContent>
      </Card>
    );
  }

  const routedTotal = eligibilityStats.eligible + eligibilityStats.excluded;

  return (
    <div className="space-y-3">
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
              eligible: eligibilityStats.eligible,
              routedTotal,
              excluded: eligibilityStats.excluded,
              voicemail: eligibilityStats.voicemail,
              tooShort: eligibilityStats.tooShort,
              insufficientExtraction: eligibilityStats.insufficientExtraction,
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
}
