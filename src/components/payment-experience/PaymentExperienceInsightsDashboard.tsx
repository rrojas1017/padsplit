import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Users, BookOpen, Repeat, FileQuestion, ShieldAlert, CalendarClock,
  Sparkles, AlertTriangle, Zap, ShieldCheck,
} from 'lucide-react';
import {
  usePaymentExperienceResponses,
  type KPIMetric,
} from '@/hooks/usePaymentExperienceResponses';
import { usePaymentExperienceAIInsight } from '@/hooks/usePaymentExperienceAIInsight';

// ── KPI tile ────────────────────────────────────────────────────────────────

interface KPIProps {
  label: string;
  value: string;
  denominator?: string;
  meta?: string;
  icon: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
}

function KPI({ label, value, denominator, meta, icon, iconBg, iconColor }: KPIProps) {
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

// ── Insight copy polish (display-only; does not mutate hook output) ─────────

function polishInsightText(text?: string | null): string {
  if (!text) return '';
  let out = text.trim();

  // Targeted phrasing fixes (machine-generated → natural prose)
  out = out.replace(
    /mainly citing cash-flow constraint and prefers manual control/gi,
    'primarily driven by cash-flow concerns and preference for manual control',
  );
  out = out.replace(
    /(?:mainly|primarily)\s+due to cash-flow concerns and preference for manual control/gi,
    'primarily driven by cash-flow concerns and preference for manual control',
  );
  // Drop dangling "with " preceding the rewritten clause (e.g. "...not enrolled), with primarily...")
  out = out.replace(
    /,?\s*with\s+(primarily driven by cash-flow concerns)/gi,
    ', $1',
  );
  out = out.replace(
    /members\s+(primarily|mainly)\s+due to/gi,
    '$1 due to',
  );
  out = out.replace(/\bare on a non-weekly pay cadence\b/gi, 'report a non-weekly pay cadence');
  out = out.replace(/\bavg move-in cost clarity\s+/gi, 'Avg. move-in cost clarity: ');
  out = out.replace(/\bavg\.\s+/g, 'Avg. ');

  // Collapse stray double spaces, duplicated commas, and trailing period duplication
  out = out.replace(/\s{2,}/g, ' ').replace(/,\s*,/g, ',').replace(/\.\.+$/g, '.');
  return out;
}

// ── AI banner ───────────────────────────────────────────────────────────────

function AIInsightBanner({ insight }: { insight: ReturnType<typeof usePaymentExperienceAIInsight>['insight'] }) {
  if (!insight?.headline) return null;
  const dateStr = insight.generatedAt
    ? new Date(insight.generatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;
  const headline = polishInsightText(insight.headline);
  const finding = polishInsightText(insight.finding);
  return (
    <Card className="bg-slate-900 border-slate-800 rounded-xl">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <Sparkles className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">
            AI Insight {insight.source === 'derived' && '· derived'}
          </span>
        </div>
        <p className="text-sm font-semibold leading-snug text-white break-words">{headline}</p>
        {finding && (
          <p className="text-xs text-slate-300 mt-1.5 leading-relaxed break-words">{finding}</p>
        )}
        <p className="text-[10px] text-slate-500 mt-2">
          {insight.totalAnalyzed != null && `${insight.totalAnalyzed.toLocaleString()} eligible surveys`}
          {dateStr && <> · Updated {dateStr}</>}
        </p>
      </CardContent>
    </Card>
  );
}

// ── Dashboard ───────────────────────────────────────────────────────────────

export function PaymentExperienceInsightsDashboard() {
  const {
    records, kpis, eligibilityStats,
    topFrictionThemes, frictionSummary, autopayBarriers, isLoading,
  } = usePaymentExperienceResponses();
  const { insight } = usePaymentExperienceAIInsight({
    kpis,
    topFriction: topFrictionThemes,
    topBarriers: autopayBarriers,
  });

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
    <div className="space-y-4">
      <AIInsightBanner insight={insight} />

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

      <div className="pt-2">
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
    </div>
  );
}
