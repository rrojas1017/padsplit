import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PaymentExperienceExtraction } from '@/types/research-insights';

/**
 * Vocabulary for booking_transcriptions.retag_source on Payment Experience records.
 *  - script_id_route: deterministic script-id routing (Phase 1B, now live).
 *  - payment_keyword_validation: Phase 1A keyword backfill.
 *  - keyword_fallback_detection: runtime keyword fallback.
 */
export const RETAG_SOURCES = {
  SCRIPT_ID_ROUTE: 'script_id_route',
  PAYMENT_KEYWORD_VALIDATION: 'payment_keyword_validation',
  KEYWORD_FALLBACK_DETECTION: 'keyword_fallback_detection',
} as const;

// ────────────────────────────────────────────────────────────────────────────
// Canonical category maps. Keys are normalized (lowercase, trimmed, punctuation
// collapsed). Values are canonical bucket labels surfaced in the UI. Extend
// freely as new free-text variants appear in production extractions.
// ────────────────────────────────────────────────────────────────────────────

export type CadenceBucket = 'weekly' | 'biweekly' | 'semi_monthly' | 'monthly' | 'other' | 'unknown';

export const CADENCE_NORMALIZATION_MAP: Record<string, CadenceBucket> = {
  'weekly': 'weekly',
  'every week': 'weekly',
  'each week': 'weekly',
  '1 week': 'weekly',
  'once a week': 'weekly',
  'per week': 'weekly',
  'biweekly': 'biweekly',
  'bi weekly': 'biweekly',
  'bi-weekly': 'biweekly',
  'every 2 weeks': 'biweekly',
  'every two weeks': 'biweekly',
  'fortnightly': 'biweekly',
  'every other week': 'biweekly',
  'semi monthly': 'semi_monthly',
  'semimonthly': 'semi_monthly',
  'semi-monthly': 'semi_monthly',
  'twice a month': 'semi_monthly',
  '2x a month': 'semi_monthly',
  'monthly': 'monthly',
  'every month': 'monthly',
  'once a month': 'monthly',
  'per month': 'monthly',
  'each month': 'monthly',
};

export const CADENCE_LABELS: Record<CadenceBucket, string> = {
  weekly: 'Weekly',
  biweekly: 'Bi-weekly',
  semi_monthly: 'Semi-monthly',
  monthly: 'Monthly',
  other: 'Other',
  unknown: 'Unknown',
};

export const FRICTION_THEME_MAP: Record<string, string> = {
  'autopay distrust': 'autopay_distrust',
  'distrust autopay': 'autopay_distrust',
  'fear of autopay': 'autopay_distrust',
  'fear autopay': 'autopay_distrust',
  'late fee confusion': 'late_fee_confusion',
  'unclear fees': 'late_fee_confusion',
  'fee confusion': 'late_fee_confusion',
  'method failure': 'method_failure',
  'method failures': 'method_failure',
  'card declined': 'method_failure',
  'payment failed': 'method_failure',
  'move in cost surprise': 'move_in_cost_surprise',
  'unexpected charges': 'move_in_cost_surprise',
  'move in cost confusion': 'move_in_cost_surprise',
  'pay cycle mismatch': 'pay_cycle_mismatch',
  'pay cycle misalignment': 'pay_cycle_mismatch',
  'paid weekly not aligned': 'pay_cycle_mismatch',
  'cadence mismatch': 'pay_cycle_mismatch',
  'app issues': 'app_ux_issues',
  'app ux': 'app_ux_issues',
  'website issues': 'app_ux_issues',
  'no friction': 'no_friction',
  'no friction reported': 'no_friction',
  'no payment friction': 'no_friction',
  'no payment problems': 'no_friction',
  'no issues': 'no_friction',
  'no issue': 'no_friction',
  'no problems': 'no_friction',
  'none': 'no_friction',
  'nothing': 'no_friction',
  'n a': 'no_friction',
  'na': 'no_friction',
};

export const NO_FRICTION_KEY = 'no_friction';

export const FRICTION_THEME_LABELS: Record<string, string> = {
  autopay_distrust: 'Auto-pay distrust',
  late_fee_confusion: 'Late-fee confusion',
  method_failure: 'Payment method failures',
  move_in_cost_surprise: 'Move-in cost surprise',
  pay_cycle_mismatch: 'Pay-cycle mismatch',
  app_ux_issues: 'App / website UX',
  no_friction: 'No friction reported',
  other: 'Other',
};

export const AUTOPAY_BARRIER_MAP: Record<string, string> = {
  "don't trust autopay": 'distrust_recurring_charges',
  'do not trust autopay': 'distrust_recurring_charges',
  'fear recurring charges': 'distrust_recurring_charges',
  'distrust recurring charges': 'distrust_recurring_charges',
  'no stable income': 'income_irregularity',
  'irregular pay': 'income_irregularity',
  'income irregular': 'income_irregularity',
  'unpredictable income': 'income_irregularity',
  'prefers control': 'wants_manual_control',
  'prefer manual': 'wants_manual_control',
  'wants to choose when to pay': 'wants_manual_control',
  'manual control': 'wants_manual_control',
  'insufficient funds': 'cashflow_constraint',
  'cashflow constraint': 'cashflow_constraint',
  'not enough money': 'cashflow_constraint',
  'no debit card': 'no_payment_method',
  'no card': 'no_payment_method',
  'unbanked': 'no_payment_method',
  "didn't know it existed": 'unaware',
  'unaware': 'unaware',
  'never heard of it': 'unaware',
};

export const AUTOPAY_BARRIER_LABELS: Record<string, string> = {
  distrust_recurring_charges: 'Distrust of recurring charges',
  income_irregularity: 'Irregular income',
  wants_manual_control: 'Prefers manual control',
  cashflow_constraint: 'Cash-flow constraint',
  no_payment_method: 'No eligible payment method',
  unaware: 'Unaware auto-pay exists',
  other: 'Other',
};

// ────────────────────────────────────────────────────────────────────────────
// Normalization helper
// ────────────────────────────────────────────────────────────────────────────

function normalizeKey(raw: any): string {
  if (raw == null) return '';
  return String(raw)
    .toLowerCase()
    .replace(/[_/]/g, ' ')
    .replace(/[^\w\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function lookup<T extends string>(map: Record<string, T>, raw: any, fallback: T): T {
  const key = normalizeKey(raw);
  if (!key) return fallback;
  if (map[key]) return map[key];
  // Loose contains match (helps with "I bi-weekly pay" etc.)
  for (const mapKey of Object.keys(map)) {
    if (key.includes(mapKey)) return map[mapKey];
  }
  return fallback;
}

function normalizeCadence(raw: any): CadenceBucket {
  if (raw == null || normalizeKey(raw) === '') return 'unknown';
  return lookup(CADENCE_NORMALIZATION_MAP, raw, 'other');
}

function normalizeFriction(raw: any): string | null {
  const key = normalizeKey(raw);
  if (!key) return null;
  return lookup(FRICTION_THEME_MAP, raw, 'other');
}

function normalizeAutopayBarrier(raw: any): string | null {
  const key = normalizeKey(raw);
  if (!key) return null;
  return lookup(AUTOPAY_BARRIER_MAP, raw, 'other');
}

// ────────────────────────────────────────────────────────────────────────────
// Record + KPI types
// ────────────────────────────────────────────────────────────────────────────

export type IneligibleReason = 'voicemail' | 'too_short' | 'insufficient_extraction';

export interface PaymentExperienceRecord {
  id: string;
  booking_id: string;
  member_name: string;
  contact_phone: string | null;
  booking_date: string;
  extraction: PaymentExperienceExtraction;
  retag_source: string | null;
  has_valid_conversation: boolean | null;
  call_duration_seconds: number | null;
  analyticsEligible: boolean;
  ineligibleReason?: IneligibleReason;
}

export interface PayCycleBreakdown {
  weekly: number;
  biweekly: number;
  semi_monthly: number;
  monthly: number;
  other: number;
  unknown: number;
}

export interface KPIMetric {
  value: number | null; // percent or score
  numerator: number;
  denominator: number;
}

export interface PaymentKPIs {
  totalRouted: number;
  totalEligible: number;
  literacy: KPIMetric;
  autopayEnrolled: KPIMetric;
  moveInClarity: KPIMetric;
  hardshipAware: KPIMetric;
  payCycleMisalignment: KPIMetric;
  payCycleBreakdown: PayCycleBreakdown;
}

export interface EligibilityStats {
  eligible: number;
  excluded: number;
  voicemail: number;
  tooShort: number;
  insufficientExtraction: number;
}

export interface RetagSourceCounts {
  script_id_route: number;
  keyword: number; // payment_keyword_validation + keyword_fallback_detection
  other: number;
}

export interface FrictionThemeAgg {
  key: string;
  label: string;
  count: number;
  share: number; // 0..1 of eligible denominator that answered
  sampleQuote: string | null;
}

export interface AutopayBarrierAgg {
  key: string;
  label: string;
  count: number;
  share: number; // share of not-enrolled denominator
  topUnlock: string | null;
}

// ────────────────────────────────────────────────────────────────────────────
// Eligibility & aggregation
// ────────────────────────────────────────────────────────────────────────────

const REQUIRED_EXTRACTION_FIELDS: (keyof PaymentExperienceExtraction)[] = [
  'payment_literacy_score',
  'autopay_status',
  'move_in_cost_clarity_1to5',
  'pay_cadence',
  'top_friction_theme',
];

const MIN_EXTRACTION_FIELDS = 3;
const MIN_CALL_SECONDS = 120;

function evaluateEligibility(
  ext: PaymentExperienceExtraction,
  hasValidConversation: boolean | null,
  callDuration: number | null,
): { eligible: boolean; reason?: IneligibleReason } {
  if (hasValidConversation === false) return { eligible: false, reason: 'voicemail' };
  if (callDuration != null && callDuration > 0 && callDuration < MIN_CALL_SECONDS) {
    return { eligible: false, reason: 'too_short' };
  }
  const present = REQUIRED_EXTRACTION_FIELDS.filter((k) => {
    const v = (ext as any)?.[k];
    return v !== null && v !== undefined && v !== '';
  }).length;
  if (present < MIN_EXTRACTION_FIELDS) return { eligible: false, reason: 'insufficient_extraction' };
  return { eligible: true };
}

function pct(num: number, den: number): number | null {
  if (!den) return null;
  return (num / den) * 100;
}

function deriveKPIs(eligible: PaymentExperienceRecord[]): PaymentKPIs {
  const literacyScores = eligible
    .map((r) => r.extraction?.payment_literacy_score)
    .filter((v): v is number => typeof v === 'number');

  const autopayAnswered = eligible.filter((r) => !!r.extraction?.autopay_status);
  const autopayEnrolled = autopayAnswered.filter((r) => r.extraction?.autopay_status === 'enrolled').length;

  const clarityScores = eligible
    .map((r) => r.extraction?.move_in_cost_clarity_1to5)
    .filter((v): v is number => typeof v === 'number');

  const hardshipAnswered = eligible.filter((r) => typeof r.extraction?.hardship_awareness_gap === 'boolean');
  const hardshipKnown = hardshipAnswered.filter((r) => r.extraction?.hardship_awareness_gap === false).length;

  const breakdown: PayCycleBreakdown = {
    weekly: 0, biweekly: 0, semi_monthly: 0, monthly: 0, other: 0, unknown: 0,
  };
  for (const r of eligible) {
    breakdown[normalizeCadence(r.extraction?.pay_cadence)]++;
  }
  const cadenceDenominator = eligible.length - breakdown.unknown;
  const misalignedNumerator = cadenceDenominator - breakdown.weekly;

  const literacyAvg = literacyScores.length ? literacyScores.reduce((a, b) => a + b, 0) / literacyScores.length : null;
  const clarityAvg = clarityScores.length ? clarityScores.reduce((a, b) => a + b, 0) / clarityScores.length : null;

  return {
    totalRouted: 0, // filled by caller
    totalEligible: eligible.length,
    literacy: { value: literacyAvg, numerator: literacyScores.length, denominator: eligible.length },
    autopayEnrolled: {
      value: pct(autopayEnrolled, autopayAnswered.length),
      numerator: autopayEnrolled,
      denominator: autopayAnswered.length,
    },
    moveInClarity: { value: clarityAvg, numerator: clarityScores.length, denominator: eligible.length },
    hardshipAware: {
      value: pct(hardshipKnown, hardshipAnswered.length),
      numerator: hardshipKnown,
      denominator: hardshipAnswered.length,
    },
    payCycleMisalignment: {
      value: pct(misalignedNumerator, cadenceDenominator),
      numerator: misalignedNumerator,
      denominator: cadenceDenominator,
    },
    payCycleBreakdown: breakdown,
  };
}

function aggregateFrictionThemes(eligible: PaymentExperienceRecord[]): FrictionThemeAgg[] {
  const counts = new Map<string, { count: number; quote: string | null }>();
  let answered = 0;
  for (const r of eligible) {
    const themeKey = normalizeFriction(r.extraction?.top_friction_theme);
    if (!themeKey) continue;
    answered++;
    const existing = counts.get(themeKey) || { count: 0, quote: null };
    existing.count++;
    if (!existing.quote && r.extraction?.friction_verbatim) {
      const q = String(r.extraction.friction_verbatim).trim();
      if (q) existing.quote = q.length > 140 ? q.slice(0, 137) + '…' : q;
    }
    counts.set(themeKey, existing);
  }
  return Array.from(counts.entries())
    .map(([key, v]) => ({
      key,
      label: FRICTION_THEME_LABELS[key] || key,
      count: v.count,
      share: answered ? v.count / answered : 0,
      sampleQuote: v.quote,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function aggregateAutopayBarriers(eligible: PaymentExperienceRecord[]): AutopayBarrierAgg[] {
  const notEnrolled = eligible.filter((r) => r.extraction?.autopay_status === 'not_enrolled');
  const denom = notEnrolled.length;
  if (!denom) return [];
  const counts = new Map<string, { count: number; unlocks: Map<string, number> }>();
  for (const r of notEnrolled) {
    const key = normalizeAutopayBarrier(r.extraction?.autopay_barrier_category);
    if (!key) continue;
    const existing = counts.get(key) || { count: 0, unlocks: new Map() };
    existing.count++;
    const unlock = (r.extraction?.autopay_unlock_condition || '').toString().trim();
    if (unlock) existing.unlocks.set(unlock, (existing.unlocks.get(unlock) || 0) + 1);
    counts.set(key, existing);
  }
  return Array.from(counts.entries())
    .map(([key, v]) => {
      let topUnlock: string | null = null;
      let topCount = 0;
      v.unlocks.forEach((c, u) => { if (c > topCount) { topCount = c; topUnlock = u; } });
      return {
        key,
        label: AUTOPAY_BARRIER_LABELS[key] || key,
        count: v.count,
        share: v.count / denom,
        topUnlock,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function computeEligibilityStats(records: PaymentExperienceRecord[]): EligibilityStats {
  let voicemail = 0, tooShort = 0, insufficientExtraction = 0, eligible = 0;
  for (const r of records) {
    if (r.analyticsEligible) eligible++;
    else if (r.ineligibleReason === 'voicemail') voicemail++;
    else if (r.ineligibleReason === 'too_short') tooShort++;
    else if (r.ineligibleReason === 'insufficient_extraction') insufficientExtraction++;
  }
  return {
    eligible,
    excluded: records.length - eligible,
    voicemail,
    tooShort,
    insufficientExtraction,
  };
}

function computeRetagCounts(records: PaymentExperienceRecord[]): RetagSourceCounts {
  const out: RetagSourceCounts = { script_id_route: 0, keyword: 0, other: 0 };
  for (const r of records) {
    if (r.retag_source === 'script_id_route') out.script_id_route++;
    else if (
      r.retag_source === 'payment_keyword_validation' ||
      r.retag_source === 'keyword_fallback_detection'
    ) out.keyword++;
    else out.other++;
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────────────────────

export function usePaymentExperienceResponses() {
  const query = useQuery({
    queryKey: ['payment-experience-responses', 'v2-eligibility'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_transcriptions')
        .select(
          'id, booking_id, retag_source, research_extraction, ' +
          'bookings!inner(member_name, contact_phone, booking_date, has_valid_conversation, call_duration_seconds)'
        )
        .eq('research_campaign_type', 'payment_experience')
        .not('research_extraction', 'is', null);

      if (error) throw error;

      return (data || []).map((row: any) => {
        const ext = (row.research_extraction || {}) as PaymentExperienceExtraction;
        const hvc = row.bookings?.has_valid_conversation ?? null;
        const dur = row.bookings?.call_duration_seconds ?? null;
        const elig = evaluateEligibility(ext, hvc, dur);
        return {
          id: row.id,
          booking_id: row.booking_id,
          member_name: row.bookings?.member_name || 'Unknown',
          contact_phone: row.bookings?.contact_phone || null,
          booking_date: row.bookings?.booking_date || '',
          extraction: ext,
          retag_source: row.retag_source || null,
          has_valid_conversation: hvc,
          call_duration_seconds: dur,
          analyticsEligible: elig.eligible,
          ineligibleReason: elig.reason,
        } as PaymentExperienceRecord;
      });
    },
  });

  const records = query.data || [];
  const eligible = records.filter((r) => r.analyticsEligible);
  const kpis: PaymentKPIs = { ...deriveKPIs(eligible), totalRouted: records.length };
  const eligibilityStats = computeEligibilityStats(records);
  const retagSourceCounts = computeRetagCounts(records);
  const topFrictionThemes = aggregateFrictionThemes(eligible);
  const autopayBarriers = aggregateAutopayBarriers(eligible);

  return {
    records,
    eligibleRecords: eligible,
    kpis,
    eligibilityStats,
    retagSourceCounts,
    topFrictionThemes,
    autopayBarriers,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
