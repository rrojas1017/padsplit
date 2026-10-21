import type { LucideIcon } from 'lucide-react';
import { Users, Star, Repeat, Share2, LifeBuoy, Wrench, CalendarCheck, DollarSign, ShieldCheck, Search, ShieldAlert, Shield, UserCheck, CalendarX } from 'lucide-react';
import type { ScriptSurveyQuestion, ScriptSurveyRecord } from '@/hooks/useScriptSurveyResponses';
import { answerLabels, answerScale } from '@/utils/scriptSurveyAnalytics';

export interface ScriptKpiConfig {
  label: string;
  hint?: string;
  kind: 'avg' | 'pct' | 'count';
  positiveOptions?: string[];
  max?: number;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  variant?: 'primary';
  accent?: 'green' | 'orange';
  denominatorText: string;
}

export interface ScriptKpiResult {
  value: number | null;
  numerator: number;
  denominator: number;
}

const surveyed: ScriptKpiConfig = {
  label: 'Members Surveyed', kind: 'count', icon: Users,
  iconBg: 'bg-primary/10', iconColor: 'text-primary', denominatorText: 'X eligible of Y routed',
};
const avg5 = (label: string, hint: string, icon: LucideIcon, extra: Partial<ScriptKpiConfig> = {}): ScriptKpiConfig => ({
  label, hint, kind: 'avg', max: 5, icon, iconBg: 'bg-primary/10', iconColor: 'text-primary',
  denominatorText: 'avg of X answers', ...extra,
});

export const SCRIPT_SURVEY_KPIS: Record<string, ScriptKpiConfig[]> = {
  '247ead24-6b86-4b19-b352-0493c1831ba9': [
    surveyed,
    avg5('Approval Clarity', 'approval_clarity', ShieldCheck),
    avg5('Trust in Screening', 'trust_in_screening', Shield),
    {
      label: 'Host Extra Screening', hint: 'host_secondary_screening_requested', kind: 'pct',
      positiveOptions: ['Yes, one host', 'Yes, every time I submitted a booking'], icon: UserCheck,
      iconBg: 'bg-primary/10', iconColor: 'text-primary', variant: 'primary', accent: 'orange',
      denominatorText: 'X of Y answered',
    },
    {
      label: 'Host-Requested Cancellations', hint: 'host_requested_cancellation_frequency', kind: 'pct',
      positiveOptions: ['Once', '2–3 times', '4+ times'], icon: CalendarX,
      iconBg: 'bg-primary/10', iconColor: 'text-primary', variant: 'primary', accent: 'orange',
      denominatorText: 'X of Y answered',
    },
    avg5('Overall CSAT', 'overall_csat', Star, { variant: 'primary', accent: 'green' }),
  ],
  'c24c5e6b-c7d8-43c6-86d5-affea47178bf': [
    surveyed,
    avg5('Overall Experience', 'overall_experience_rating', Star),
    avg5('Renewal Intent', 'renewal_intent', Repeat, { variant: 'primary', accent: 'green' }),
    avg5('Referral Likelihood', 'referral_likelihood', Share2),
    avg5('Support Rating', 'support_rating', LifeBuoy),
    {
      label: 'Unresolved Maintenance', hint: 'maintenance_status', kind: 'pct',
      positiveOptions: ['Yes — still unresolved'], icon: Wrench,
      iconBg: 'bg-primary/10', iconColor: 'text-primary', variant: 'primary', accent: 'orange',
      denominatorText: 'X of Y answered',
    },
  ],
  '827b23ef-3f35-4108-8462-468bf6cf7872': [
    surveyed,
    avg5('Future Booking Intent', 'future_intent', CalendarCheck, { variant: 'primary', accent: 'green' }),
    avg5('Cost Clarity', 'cost_clarity', DollarSign),
    avg5('Approval Clarity', 'approval_clarity', ShieldCheck),
    avg5('Search Ease', 'search_ease', Search),
    {
      label: 'Trust Concern', hint: 'trust_concern_level', kind: 'pct',
      positiveOptions: ['Yes — had concerns', 'Somewhat'], icon: ShieldAlert,
      iconBg: 'bg-primary/10', iconColor: 'text-primary', variant: 'primary', accent: 'orange',
      denominatorText: 'X of Y answered',
    },
  ],
};

const norm = (s: string) => s.trim().toLowerCase().replace(/[—–]/g, '-').replace(/\s+/g, ' ');

export function computeScriptKpis(
  config: ScriptKpiConfig[],
  questions: ScriptSurveyQuestion[],
  eligible: ScriptSurveyRecord[],
  routedCount?: number,
): ScriptKpiResult[] {
  return config.map((k) => {
    if (k.kind === 'count') {
      return { value: eligible.length, numerator: eligible.length, denominator: routedCount ?? eligible.length };
    }
    const q = questions.find((x) => x.ai_extraction_hint === k.hint);
    if (!q) return { value: null, numerator: 0, denominator: 0 };
    if (k.kind === 'avg') {
      const vals = eligible.map((r) => answerScale(r.answers[q.id])).filter((v): v is number => v !== null);
      return { value: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null, numerator: vals.length, denominator: eligible.length };
    }
    const pos = new Set((k.positiveOptions || []).map(norm));
    let answered = 0, hits = 0;
    for (const r of eligible) {
      const labels = answerLabels(r.answers[q.id]);
      if (!labels.length) continue;
      answered++;
      if (labels.some((l) => pos.has(norm(l)))) hits++;
    }
    return { value: answered ? (hits / answered) * 100 : null, numerator: hits, denominator: answered };
  });
}

// ── Shared formatting (dashboard tiles + Word brief use the same helpers) ────

export function formatKpiValue(k: ScriptKpiConfig, r: ScriptKpiResult): string {
  if (r.value == null) return '—';
  if (k.kind === 'avg') return `${r.value.toFixed(1)}/${k.max ?? 5}`;
  if (k.kind === 'pct') return `${Math.round(r.value)}%`;
  return r.value.toLocaleString();
}

export function kpiDenominator(k: ScriptKpiConfig, r: ScriptKpiResult): string {
  if (k.kind === 'count') return `${r.numerator.toLocaleString()} with answers of ${r.denominator.toLocaleString()} routed`;
  if (k.kind === 'avg') return `Based on ${r.numerator.toLocaleString()} responses`;
  return `${r.numerator.toLocaleString()} of ${r.denominator.toLocaleString()} answered`;
}

export const SCRIPT_SURVEY_PURPOSE: Record<string, string> = {
  '247ead24-6b86-4b19-b352-0493c1831ba9':
    'how members experience PadSplit approval, host secondary screening and fees, host-requested cancellations, and which transparency features and profile information would help them book faster',
  'c24c5e6b-c7d8-43c6-86d5-affea47178bf':
    'experience of members in their first 30 days after move-in (renewal, referral, support, maintenance)',
  '827b23ef-3f35-4108-8462-468bf6cf7872':
    'why leads who engaged did not book (cost clarity, approval, search, trust, future intent)',
};
