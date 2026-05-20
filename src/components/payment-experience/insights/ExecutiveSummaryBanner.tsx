import { Sparkles } from 'lucide-react';
import type { PaymentAIInsight } from '@/hooks/usePaymentExperienceAIInsight';
import type { PaymentKPIs, FrictionThemeAgg } from '@/hooks/usePaymentExperienceResponses';
import type { SuggestedAction } from '@/utils/paymentExperienceAnalytics';

// Local polish helper (mirrors the one inside the dashboard for the headline only).
function polish(text?: string | null): string {
  if (!text) return '';
  let out = text.trim();
  out = out.replace(
    /mainly citing cash-flow constraint and prefers manual control/gi,
    'primarily driven by cash-flow concerns and preference for manual control',
  );
  out = out.replace(
    /(?:mainly|primarily)\s+due to cash-flow concerns and preference for manual control/gi,
    'primarily driven by cash-flow concerns and preference for manual control',
  );
  out = out.replace(/,?\s*with\s+(primarily driven by cash-flow concerns)/gi, ', $1');
  out = out.replace(/members\s+(primarily|mainly)\s+due to/gi, '$1 due to');
  out = out.replace(/\bare on a non-weekly pay cadence\b/gi, 'report a non-weekly pay cadence');
  out = out.replace(/\s{2,}/g, ' ').replace(/,\s*,/g, ',').replace(/\.\.+$/g, '.');
  return out;
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'Updated recently';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'Updated recently';
  const mins = Math.max(1, Math.round((Date.now() - t) / 60000));
  if (mins < 60) return `Updated ${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `Updated ${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `Updated ${days}d ago`;
  return `Updated ${new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

interface Chip {
  key: string;
  label: string;
}

interface ExecutiveSummaryBannerProps {
  insight: PaymentAIInsight | null;
  kpis: PaymentKPIs;
  topFrictionThemes: FrictionThemeAgg[];
  firstAction?: SuggestedAction;
}

export function ExecutiveSummaryBanner({
  insight,
  kpis,
  topFrictionThemes,
  firstAction,
}: ExecutiveSummaryBannerProps) {
  if (!insight?.headline) return null;

  // Build chips ordered by operational importance:
  // 1) Non-weekly pay cadence  2) Hardship-unaware  3) Auto-pay enrollment  4) Top friction theme
  const chips: Chip[] = [];

  if (kpis.payCycleMisalignment.denominator > 0 && kpis.payCycleMisalignment.value != null) {
    chips.push({
      key: 'cadence',
      label: `${Math.round(kpis.payCycleMisalignment.value)}% non-weekly pay cadence`,
    });
  }
  if (kpis.hardshipAware.denominator > 0 && kpis.hardshipAware.value != null) {
    chips.push({
      key: 'hardship',
      label: `${Math.round(100 - kpis.hardshipAware.value)}% hardship-unaware`,
    });
  }
  if (kpis.autopayEnrolled.denominator > 0 && kpis.autopayEnrolled.value != null) {
    chips.push({
      key: 'autopay',
      label: `${Math.round(kpis.autopayEnrolled.value)}% auto-pay enrollment`,
    });
  }
  const topFriction = topFrictionThemes.find((t) => t.key !== 'no_friction' && t.key !== 'other');
  if (topFriction) {
    chips.push({
      key: 'friction',
      label: `Top friction: ${topFriction.label.toLowerCase()}`,
    });
  }
  const limitedChips = chips.slice(0, 4);

  const focusText =
    firstAction?.title?.trim() ||
    'Focus onboarding and reminder flows on flexible payment education.';

  const headline = polish(insight.headline);
  const freshness = relativeTime(insight.generatedAt);
  const surveysLabel =
    insight.totalAnalyzed != null
      ? `Based on ${insight.totalAnalyzed.toLocaleString()} eligible responses`
      : null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3.5 md:px-5 md:py-4">
      {/* Header chip */}
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">
          Executive Summary {insight.source === 'derived' && '· derived'}
        </span>
      </div>

      {/* A. Primary finding */}
      <p className="text-base md:text-lg font-semibold leading-snug text-white break-words">
        {headline}
      </p>

      {/* B. Supporting signals */}
      {limitedChips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {limitedChips.map((c) => (
            <span
              key={c.key}
              className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-200"
            >
              {c.label}
            </span>
          ))}
        </div>
      )}

      {/* C. Operational focus */}
      <p className="mt-3 text-xs text-slate-300 leading-relaxed">
        <span className="text-slate-400 font-medium">Focus: </span>
        {focusText}
      </p>

      {/* Freshness footer */}
      <div className="mt-3 flex items-center justify-end gap-2 text-[10px] text-slate-500">
        {surveysLabel && <span>{surveysLabel}</span>}
        {surveysLabel && <span aria-hidden>·</span>}
        <span>{freshness}</span>
      </div>
    </div>
  );
}
