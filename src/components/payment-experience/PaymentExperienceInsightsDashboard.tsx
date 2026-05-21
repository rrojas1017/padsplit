import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Users, BookOpen, Repeat, FileQuestion, ShieldAlert, CalendarClock,
  AlertTriangle, Zap,
} from 'lucide-react';
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
import { SegmentedInsightsSection } from './insights/SegmentedInsightsSection';
import { KeyDriversSection } from './insights/KeyDriversSection';
import { EmergingRisksSection } from './insights/EmergingRisksSection';
import { SuggestedActionsSection } from './insights/SuggestedActionsSection';
import { SurveyFunnelSection } from './insights/SurveyFunnelSection';

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
}

function KPI({ label, value, denominator, meta, caption, icon, iconBg, iconColor }: KPIProps) {
  return (
    <Card className="h-full">
      <CardContent className="p-4 h-full flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0 flex-1">
            <p className="text-[13px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
            <p className="text-4xl font-bold tracking-tight text-foreground leading-none">{value}</p>
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
            <p className="text-[11px] text-muted-foreground/70 leading-snug break-words italic">{caption}</p>
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
const denom = (m: KPIMetric) =>
  m.denominator ? `N=${m.numerator.toLocaleString()}/${m.denominator.toLocaleString()}` : 'N=0';

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
          value={records.length.toLocaleString()}
          denominator={`${records.length.toLocaleString()} surveyed`}
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
          icon={<Repeat className="h-4 w-4" />}
          iconBg="bg-green-50"
          iconColor="text-green-600"
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
          icon={<ShieldAlert className="h-4 w-4" />}
          iconBg="bg-rose-50"
          iconColor="text-rose-600"
        />
        <KPI
          label="Pay-cycle Misalignment"
          value={fmtPct(kpis.payCycleMisalignment)}
          denominator={`${kpis.payCycleMisalignment.numerator.toLocaleString()} non-weekly schedules`}
          icon={<CalendarClock className="h-4 w-4" />}
          iconBg="bg-orange-50"
          iconColor="text-orange-600"
        />
      </div>

      {analytics.surveyFunnel.length >= 2 && (
        <>
          <SectionHeader title="Survey Funnel" />
          <SurveyFunnelSection steps={analytics.surveyFunnel} />
        </>
      )}

      <div className="pt-1">
        <h2 className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          Member Insights
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Payment Friction Summary */}
        <Card className="h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Payment Friction Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {frictionSummary.noFrictionCount > 0 && (
              <p className="text-xs text-muted-foreground mb-3">
                {Math.round(frictionSummary.noFrictionShare * 100)}% reported no major payment friction
              </p>
            )}
            {topFrictionThemes.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                {frictionSummary.noFrictionCount > 0
                  ? 'No additional friction themes reported.'
                  : 'Not enough qualitative friction data yet.'}
              </p>
            ) : (
              <ul className="space-y-3">
                {topFrictionThemes.map((t) => (
                  <li key={t.key} className="border-b border-border last:border-0 pb-2 last:pb-0">
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-sm font-medium text-foreground min-w-0 truncate">{t.label}</span>
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {t.count} · {Math.round(t.share * 100)}%
                      </span>
                    </div>
                    {t.sampleQuote && (
                      <p className="text-xs text-muted-foreground italic mt-1 line-clamp-4 break-words">
                        "{t.sampleQuote}"
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Auto-pay Barriers */}
        {autopayBarriers.length > 0 && (
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-blue-500" />
                Auto-pay Barriers
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground mb-3">
                Among {kpis.autopayEnrolled.denominator - kpis.autopayEnrolled.numerator} not-enrolled members
              </p>
              <ul className="space-y-3">
                {autopayBarriers.map((b) => (
                  <li key={b.key} className="border-b border-border last:border-0 pb-2 last:pb-0">
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-sm font-medium text-foreground min-w-0 truncate">{b.label}</span>
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {b.count} · {Math.round(b.share * 100)}%
                      </span>
                    </div>
                    {b.topUnlock && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-3 leading-relaxed break-words">
                        <span className="text-foreground/70 font-medium">Unlock:</span> {b.topUnlock}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Analytics Eligibility */}
        <Card className="h-full bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Analytics Eligibility
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="divide-y divide-border">
              <li className="flex items-baseline justify-between gap-4 py-2">
                <span className="text-xs text-muted-foreground">Eligible responses</span>
                <span className="text-sm tabular-nums text-foreground shrink-0">
                  {eligibilityStats.eligible.toLocaleString()} / {routedTotal.toLocaleString()}
                </span>
              </li>
              <li className="flex items-baseline justify-between gap-4 py-2">
                <span className="text-xs text-muted-foreground">Excluded responses</span>
                <span className="text-sm tabular-nums text-foreground shrink-0">
                  {eligibilityStats.excluded.toLocaleString()}
                </span>
              </li>
              {eligibilityStats.voicemail > 0 && (
                <li className="flex items-baseline justify-between gap-4 py-2">
                  <span className="text-xs text-muted-foreground">Voicemail / invalid conversation</span>
                  <span className="text-sm tabular-nums text-foreground shrink-0">
                    {eligibilityStats.voicemail.toLocaleString()}
                  </span>
                </li>
              )}
              {eligibilityStats.tooShort > 0 && (
                <li className="flex items-baseline justify-between gap-4 py-2">
                  <span className="text-xs text-muted-foreground">Too short (&lt;120s)</span>
                  <span className="text-sm tabular-nums text-foreground shrink-0">
                    {eligibilityStats.tooShort.toLocaleString()}
                  </span>
                </li>
              )}
              {eligibilityStats.insufficientExtraction > 0 && (
                <li className="flex items-baseline justify-between gap-4 py-2">
                  <span className="text-xs text-muted-foreground">Incomplete extraction</span>
                  <span className="text-sm tabular-nums text-foreground shrink-0">
                    {eligibilityStats.insufficientExtraction.toLocaleString()}
                  </span>
                </li>
              )}
              {eligibilityStats.excluded === 0 && (
                <li className="py-2 text-xs text-muted-foreground">All routed responses are eligible.</li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      {analytics.segmentedInsights.length > 0 && (
        <>
          <SectionHeader title="Segmented Insights" />
          <SegmentedInsightsSection segments={analytics.segmentedInsights} />
        </>
      )}

      {analytics.keyDrivers.length > 0 && (
        <>
          <SectionHeader title="Key Drivers" />
          <KeyDriversSection drivers={analytics.keyDrivers} />
        </>
      )}

      {analytics.emergingRisks.length > 0 && (
        <>
          <SectionHeader title="Top Emerging Risks" emphasis />
          <EmergingRisksSection risks={analytics.emergingRisks} />
        </>
      )}

      {analytics.suggestedActions.length > 0 && (
        <>
          <SectionHeader title="Suggested Actions" />
          <SuggestedActionsSection actions={analytics.suggestedActions} />
        </>
      )}

    </div>
  );
}
