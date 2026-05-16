import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users, BookOpen, Repeat, FileQuestion, ShieldAlert, CalendarClock,
  Sparkles, AlertTriangle, Zap, ShieldCheck,
} from 'lucide-react';
import {
  usePaymentExperienceResponses,
  type KPIMetric,
  type EligibilityStats,
  type RetagSourceCounts,
} from '@/hooks/usePaymentExperienceResponses';
import { usePaymentExperienceAIInsight } from '@/hooks/usePaymentExperienceAIInsight';

// ── KPI tile ────────────────────────────────────────────────────────────────

interface KPIProps {
  label: string;
  value: string;
  denominator?: string;
  meta?: string;
  icon: React.ReactNode;
}

function KPI({ label, value, denominator, meta, icon }: KPIProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold text-foreground">{value}</p>
            {denominator && <p className="text-[11px] text-muted-foreground">{denominator}</p>}
            {meta && <p className="text-[11px] text-muted-foreground/80 truncate">{meta}</p>}
          </div>
          <div className="text-muted-foreground shrink-0">{icon}</div>
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

// ── AI banner ───────────────────────────────────────────────────────────────

function AIInsightBanner({ insight }: { insight: ReturnType<typeof usePaymentExperienceAIInsight>['insight'] }) {
  if (!insight?.headline) return null;
  const dateStr = insight.generatedAt
    ? new Date(insight.generatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;
  return (
    <Card className="bg-slate-900 border-slate-800 rounded-xl">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <Sparkles className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">
            AI Insight {insight.source === 'derived' && '· derived'}
          </span>
        </div>
        <p className="text-sm font-semibold leading-snug text-white">{insight.headline}</p>
        {insight.finding && (
          <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">{insight.finding}</p>
        )}
        <p className="text-[11px] text-slate-500 mt-2">
          {insight.totalAnalyzed != null && `${insight.totalAnalyzed.toLocaleString()} eligible surveys`}
          {dateStr && <> · Updated {dateStr}</>}
        </p>
      </CardContent>
    </Card>
  );
}

// ── Members Surveyed inline meta ────────────────────────────────────────────

function membersMeta(retag: RetagSourceCounts, elig: EligibilityStats): { denom: string; meta: string } {
  const denomLine = `N=${(elig.eligible + elig.excluded).toLocaleString()} routed`;
  const retagBits = [
    `script_id_route: ${retag.script_id_route.toLocaleString()}`,
    `keyword: ${retag.keyword.toLocaleString()}`,
  ];
  if (retag.other) retagBits.push(`other: ${retag.other.toLocaleString()}`);
  return { denom: denomLine, meta: retagBits.join(' · ') };
}

// ── Dashboard ───────────────────────────────────────────────────────────────

export function PaymentExperienceInsightsDashboard() {
  const {
    records, kpis, eligibilityStats, retagSourceCounts,
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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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

  const mm = membersMeta(retagSourceCounts, eligibilityStats);

  return (
    <div className="space-y-4">
      <AIInsightBanner insight={insight} />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KPI
          label="Members Surveyed"
          value={records.length.toLocaleString()}
          denominator={mm.denom}
          meta={mm.meta}
          icon={<Users className="w-4 h-4" />}
        />
        <KPI
          label="Avg Payment Literacy"
          value={fmtScore(kpis.literacy, 100)}
          denominator={denom(kpis.literacy)}
          meta="Composite of Q1–Q4"
          icon={<BookOpen className="w-4 h-4" />}
        />
        <KPI
          label="Auto-pay Enrolled"
          value={fmtPct(kpis.autopayEnrolled)}
          denominator={denom(kpis.autopayEnrolled)}
          icon={<Repeat className="w-4 h-4" />}
        />
        <KPI
          label="Move-in Cost Clarity"
          value={fmtScore(kpis.moveInClarity, 5)}
          denominator={denom(kpis.moveInClarity)}
          meta="Q10 (1–5 scale)"
          icon={<FileQuestion className="w-4 h-4" />}
        />
        <KPI
          label="Hardship-Aware"
          value={fmtPct(kpis.hardshipAware)}
          denominator={denom(kpis.hardshipAware)}
          meta="Knew at least one option"
          icon={<ShieldAlert className="w-4 h-4" />}
        />
        <KPI
          label="Pay-cycle Misalignment"
          value={fmtPct(kpis.payCycleMisalignment)}
          denominator={denom(kpis.payCycleMisalignment)}
          meta={`weekly ${kpis.payCycleBreakdown.weekly} · bi ${kpis.payCycleBreakdown.biweekly} · mo ${kpis.payCycleBreakdown.monthly} · other ${kpis.payCycleBreakdown.other}`}
          icon={<CalendarClock className="w-4 h-4" />}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Top Payment Friction */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Top Payment Friction
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {topFrictionThemes.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4">
                Not enough qualitative friction data yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {topFrictionThemes.map((t) => (
                  <li key={t.key} className="border-b border-border last:border-0 pb-2 last:pb-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">{t.label}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {t.count} · {Math.round(t.share * 100)}%
                      </span>
                    </div>
                    {t.sampleQuote && (
                      <p className="text-xs text-muted-foreground italic mt-1">"{t.sampleQuote}"</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Auto-pay Barriers */}
        {autopayBarriers.length > 0 && (
          <Card>
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
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">{b.label}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {b.count} · {Math.round(b.share * 100)}%
                      </span>
                    </div>
                    {b.topUnlock && (
                      <p className="text-xs text-muted-foreground mt-1">
                        <span className="text-foreground/70 font-medium">Unlock:</span> {b.topUnlock}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
