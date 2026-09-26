import type { LucideIcon } from 'lucide-react';
import { Users, Star, Repeat, Share2, LifeBuoy, Wrench, CalendarCheck, DollarSign, ShieldCheck, Search, ShieldAlert } from 'lucide-react';
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
