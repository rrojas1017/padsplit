/**
 * Payment Experience — single answer resolver + exact-match normalizer.
 * Every PE KPI, aggregate and Script Responses tile reads through here.
 * EXACT key maps only: no substring / contains matching.
 */
import type { PaymentExperienceRecord, CadenceBucket } from '@/hooks/usePaymentExperienceResponses';

export function canon(s: unknown): string {
  if (s == null) return '';
  return String(s).toLowerCase().replace(/[^a-z0-9']+/g, ' ').trim();
}

function table<T extends string>(groups: Array<[T, string[]]>): Map<string, T> {
  const m = new Map<string, T>();
  for (const [v, keys] of groups) for (const k of keys) m.set(k, v);
  return m;
}

const CADENCE = table<CadenceBucket>([
  ['weekly', ['weekly', 'every week', 'once a week']],
  ['biweekly', ['bi weekly', 'biweekly', 'every 2 weeks', 'every two weeks', 'every other week', 'fortnightly']],
  ['semi_monthly', ['semi monthly', 'semimonthly', 'twice a month']],
  ['monthly', ['monthly', 'once a month', 'every month']],
  ['other', ['irregular', 'daily', 'other']],
  ['unknown', ['unknown', 'unsure', 'not discussed']],
]);

export type AutopayAnswer = 'yes' | 'no' | 'unanswered';
const AUTOPAY = table<'yes' | 'no'>([
  ['yes', ['yes', 'enrolled']],
  ['no', ['no', 'not enrolled', 'declined']],
]);

const FRICTION = table<string>([
  ['autopay_distrust', ['auto pay distrust', 'autopay distrust']],
  ['late_fee_confusion', ['late fee confusion', 'late fees unclear']],
  ['method_failure', ['payment method failures', 'method failure', 'method rejected']],
  ['move_in_cost_surprise', ['move in cost surprise']],
  ['pay_cycle_mismatch', ['pay cycle mismatch', 'dynamic due dates']],
  ['app_ux_issues', ['app website ux', 'app ux issues']],
  ['no_friction', ['no friction reported', 'no friction', 'none', 'nothing', 'n a', 'na']],
]);

const BARRIER = table<string>([
  ['distrust_recurring_charges', ['distrust of recurring charges', 'distrust recurring charges', 'distrust auto charges']],
  ['income_irregularity', ['irregular income', 'income irregularity']],
  ['wants_manual_control', ['prefers manual control', 'prefer manual control', 'wants manual control']],
  ['cashflow_constraint', ['cash flow constraint', 'cashflow constraint', 'insufficient funds risk']],
  ['no_payment_method', ['no eligible payment method', 'no payment method']],
  ['unaware', ['unaware auto pay exists', 'unaware']],
  ['unanswered', ['n a', 'na', 'none']],
]);

export function normalizeCadence(raw: unknown): CadenceBucket {
  const k = canon(raw);
  if (!k) return 'unknown';
  return CADENCE.get(k) ?? 'other';
}

export function normalizeAutopay(raw: unknown): AutopayAnswer {
  return AUTOPAY.get(canon(raw)) ?? 'unanswered';
}

export function normalizeFriction(raw: unknown): string | null {
  const k = canon(raw);
  if (!k) return null;
  return FRICTION.get(k) ?? 'other';
}

export function normalizeBarrier(raw: unknown): string | null {
  const k = canon(raw);
  if (!k) return null;
  return BARRIER.get(k) ?? 'other';
}

export type ResolvableQid =
  | 'pay_cadence'
  | 'autopay_enrolled'
  | 'top_friction_theme'
  | 'autopay_barrier'
  | 'move_in_cost_clarity';

const LEGACY_FIELD: Record<ResolvableQid, string> = {
  pay_cadence: 'pay_cadence',
  autopay_enrolled: 'autopay_status',
  top_friction_theme: 'top_friction_theme',
  autopay_barrier: 'autopay_barrier_category',
  move_in_cost_clarity: 'move_in_cost_clarity_1to5',
};

interface LooseRawAnswer {
  status?: unknown;
  selected_option_labels?: unknown;
  scale_value?: unknown;
}

export function resolveAnswer(record: PaymentExperienceRecord, qid: ResolvableQid): string | number | null {
  const ext = (record.extraction ?? {}) as Record<string, unknown>;
  const rawMap = ext.raw_script_answers;
  const entry: LooseRawAnswer | null =
    rawMap && typeof rawMap === 'object' && (rawMap as Record<string, unknown>)[qid] && typeof (rawMap as Record<string, unknown>)[qid] === 'object'
      ? ((rawMap as Record<string, unknown>)[qid] as LooseRawAnswer)
      : null;
  if (entry) {
    const labels = Array.isArray(entry.selected_option_labels) ? entry.selected_option_labels : [];
    const first = labels.length > 0 && labels[0] != null ? String(labels[0]).trim() : '';
    const scale = typeof entry.scale_value === 'number' && Number.isFinite(entry.scale_value) ? entry.scale_value : null;
    const usable =
      entry.status === 'answered' || (entry.status == null && (first !== '' || scale !== null));
    if (usable) {
      if (qid === 'move_in_cost_clarity') {
        if (scale !== null) return scale;
      } else if (first !== '') {
        return first;
      }
    }
  }
  const legacy = ext[LEGACY_FIELD[qid]];
  if (typeof legacy === 'number' && Number.isFinite(legacy)) return legacy;
  if (typeof legacy === 'string' && legacy.trim() !== '') return legacy;
  return null;
}

export const resolvedCadence = (r: PaymentExperienceRecord): CadenceBucket =>
  normalizeCadence(resolveAnswer(r, 'pay_cadence'));
export const resolvedAutopay = (r: PaymentExperienceRecord): AutopayAnswer =>
  normalizeAutopay(resolveAnswer(r, 'autopay_enrolled'));
export const resolvedFriction = (r: PaymentExperienceRecord): string | null =>
  normalizeFriction(resolveAnswer(r, 'top_friction_theme'));
export const resolvedBarrier = (r: PaymentExperienceRecord): string | null =>
  normalizeBarrier(resolveAnswer(r, 'autopay_barrier'));
export function resolvedClarity(r: PaymentExperienceRecord): number | null {
  const v = resolveAnswer(r, 'move_in_cost_clarity');
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
}
