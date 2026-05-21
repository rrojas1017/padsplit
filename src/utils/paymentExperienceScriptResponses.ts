// src/utils/paymentExperienceScriptResponses.ts
// Pure client-side derivation: turns Payment Experience extractions into
// per-question response distributions, modeled on the research dashboard
// Script Responses panel. No backend, no new business logic — reuses the
// canonical normalization maps from usePaymentExperienceResponses.

import {
  type PaymentExperienceRecord,
  CADENCE_NORMALIZATION_MAP,
  CADENCE_LABELS,
  FRICTION_THEME_MAP,
  FRICTION_THEME_LABELS,
  AUTOPAY_BARRIER_MAP,
  AUTOPAY_BARRIER_LABELS,
} from '@/hooks/usePaymentExperienceResponses';

export type PEQuestionType = 'multi' | 'yesno' | 'scale' | 'open';

export interface PEQuestionDef {
  order: number;
  id: string;
  text: string;
  type: PEQuestionType;
  scaleMin?: number;
  scaleMax?: number;
}

export const PE_QUESTIONS: PEQuestionDef[] = [
  { order: 1, id: 'payment_literacy_score', text: 'Payment literacy score', type: 'scale', scaleMin: 0, scaleMax: 100 },
  { order: 2, id: 'autopay_enrolled', text: 'Are you enrolled in auto-pay?', type: 'yesno' },
  { order: 3, id: 'autopay_barrier', text: 'What is keeping you from auto-pay?', type: 'multi' },
  { order: 4, id: 'autopay_unlock', text: 'What would unlock auto-pay for you?', type: 'open' },
  { order: 5, id: 'move_in_cost_clarity', text: 'Move-in cost clarity (1–5)', type: 'scale', scaleMin: 1, scaleMax: 5 },
  { order: 6, id: 'pay_cadence', text: 'How often do you get paid?', type: 'multi' },
  { order: 7, id: 'hardship_awareness_gap', text: 'Hardship awareness gap', type: 'yesno' },
  { order: 8, id: 'top_friction_theme', text: 'Top friction theme', type: 'multi' },
  { order: 9, id: 'friction_verbatim', text: 'Describe your friction (verbatim)', type: 'open' },
];

export interface PEDistributionItem {
  key: string;
  label: string;
  count: number;
  percentage: number; // 0..100
}

export interface PEQuestionSummary {
  question: PEQuestionDef;
  count: number; // # eligible records that answered this question
  distribution: PEDistributionItem[]; // multi/yesno/scale (per-bucket)
  avg?: number; // scale only
  min?: number; // scale only
  max?: number; // scale only
  uniqueAnswers?: number; // multi only
  topLabel?: string; // multi/yesno
  topCount?: number;
  topPct?: number;
  samples?: string[]; // open-ended trimmed verbatims (≤25)
  totalSamples?: number; // total open-ended responses (before trim)
}

export interface PEScriptStats {
  responseCount: number; // eligible records (respondents)
  questionCount: number;
  completionRate: number; // 0..100, avg over questions of (answered/respondents)
  avgQuestionsAnswered: number; // mean # questions answered per respondent
  respondents: number;
  latestResponseAt: string | null;
}

export interface PEScriptData {
  questions: PEQuestionSummary[];
  stats: PEScriptStats;
}

// ── helpers ────────────────────────────────────────────────────────────────

const lookupNormalized = (
  map: Record<string, string>,
  raw: any,
): string | null => {
  if (raw == null) return null;
  const key = String(raw)
    .toLowerCase()
    .replace(/[_/]/g, ' ')
    .replace(/[^\w\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!key) return null;
  if (map[key]) return map[key];
  for (const k of Object.keys(map)) {
    if (key.includes(k)) return map[k];
  }
  return 'other';
};

const trim = (s: string, n = 240) =>
  s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;

const pct = (num: number, den: number) =>
  den > 0 ? Math.round((num / den) * 1000) / 10 : 0;

// Returns the value extracted for this question, or null if "not answered".
function getAnswer(rec: PaymentExperienceRecord, q: PEQuestionDef): any {
  const ext = rec.extraction || {};
  switch (q.id) {
    case 'payment_literacy_score':
      return typeof ext.payment_literacy_score === 'number' ? ext.payment_literacy_score : null;
    case 'autopay_enrolled':
      if (ext.autopay_status === 'enrolled') return 'yes';
      if (ext.autopay_status === 'not_enrolled') return 'no';
      return null;
    case 'autopay_barrier':
      if (ext.autopay_status !== 'not_enrolled') return null;
      return lookupNormalized(AUTOPAY_BARRIER_MAP, ext.autopay_barrier_category);
    case 'autopay_unlock': {
      if (ext.autopay_status !== 'not_enrolled') return null;
      const v = (ext.autopay_unlock_condition || '').toString().trim();
      return v || null;
    }
    case 'move_in_cost_clarity':
      return typeof ext.move_in_cost_clarity_1to5 === 'number' ? ext.move_in_cost_clarity_1to5 : null;
    case 'pay_cadence': {
      if (ext.pay_cadence == null || String(ext.pay_cadence).trim() === '') return null;
      const norm = lookupNormalized(CADENCE_NORMALIZATION_MAP, ext.pay_cadence);
      return norm || 'other';
    }
    case 'hardship_awareness_gap':
      if (typeof ext.hardship_awareness_gap !== 'boolean') return null;
      return ext.hardship_awareness_gap ? 'yes' : 'no';
    case 'top_friction_theme':
      return lookupNormalized(FRICTION_THEME_MAP, ext.top_friction_theme);
    case 'friction_verbatim': {
      const v = (ext.friction_verbatim || '').toString().trim();
      return v || null;
    }
    default:
      return null;
  }
}

function labelFor(qId: string, key: string): string {
  if (qId === 'autopay_barrier') return AUTOPAY_BARRIER_LABELS[key] || key;
  if (qId === 'pay_cadence') return CADENCE_LABELS[key as keyof typeof CADENCE_LABELS] || key;
  if (qId === 'top_friction_theme') return FRICTION_THEME_LABELS[key] || key;
  if (qId === 'autopay_enrolled' || qId === 'hardship_awareness_gap') {
    return key === 'yes' ? 'Yes' : 'No';
  }
  return key;
}

function summarizeQuestion(
  q: PEQuestionDef,
  eligible: PaymentExperienceRecord[],
): PEQuestionSummary {
  const answers: any[] = [];
  for (const r of eligible) {
    const a = getAnswer(r, q);
    if (a !== null && a !== undefined && a !== '') answers.push(a);
  }
  const count = answers.length;

  if (q.type === 'open') {
    const samples = answers
      .map((a) => trim(String(a), 240))
      .slice(0, 25);
    return {
      question: q,
      count,
      distribution: [],
      samples,
      totalSamples: count,
    };
  }

  if (q.type === 'scale') {
    const nums = answers.filter((n) => typeof n === 'number') as number[];
    const min = q.scaleMin ?? 0;
    const max = q.scaleMax ?? 100;
    const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
    // For scales 1–5 we render per-integer buckets; for 0–100 we
    // bucket into deciles 0-9,10-19,…,90-100 to keep the histogram readable.
    const distribution: PEDistributionItem[] = [];
    if (max - min <= 10) {
      for (let v = min; v <= max; v++) {
        const c = nums.filter((n) => Math.round(n) === v).length;
        distribution.push({
          key: String(v),
          label: String(v),
          count: c,
          percentage: pct(c, nums.length),
        });
      }
    } else {
      const buckets = 10;
      const span = (max - min + 1) / buckets;
      for (let i = 0; i < buckets; i++) {
        const lo = Math.round(min + i * span);
        const hi = i === buckets - 1 ? max : Math.round(min + (i + 1) * span) - 1;
        const c = nums.filter((n) => n >= lo && n <= hi).length;
        distribution.push({
          key: `${lo}-${hi}`,
          label: `${lo}–${hi}`,
          count: c,
          percentage: pct(c, nums.length),
        });
      }
    }
    return {
      question: q,
      count: nums.length,
      distribution,
      avg,
      min,
      max,
    };
  }

  // multi / yesno
  const buckets = new Map<string, number>();
  for (const a of answers) buckets.set(a, (buckets.get(a) || 0) + 1);
  let entries = Array.from(buckets.entries());
  if (q.type === 'yesno') {
    // Ensure stable order: Yes first, then No
    const yes = buckets.get('yes') || 0;
    const no = buckets.get('no') || 0;
    entries = [
      ['yes', yes],
      ['no', no],
    ];
  } else {
    entries.sort((a, b) => b[1] - a[1]);
  }
  const distribution: PEDistributionItem[] = entries.map(([key, c]) => ({
    key,
    label: labelFor(q.id, key),
    count: c,
    percentage: pct(c, count),
  }));
  const top = distribution.find((d) => d.count > 0);
  return {
    question: q,
    count,
    distribution,
    uniqueAnswers: q.type === 'multi' ? distribution.filter((d) => d.count > 0).length : undefined,
    topLabel: top?.label,
    topCount: top?.count,
    topPct: top?.percentage,
  };
}

export function derivePaymentExperienceScriptData(
  eligible: PaymentExperienceRecord[],
  _totalRouted: number,
): PEScriptData {
  const questions = PE_QUESTIONS.map((q) => summarizeQuestion(q, eligible));
  const respondents = eligible.length;

  // Per-respondent answered count
  let totalAnswered = 0;
  for (const r of eligible) {
    for (const q of PE_QUESTIONS) {
      const a = getAnswer(r, q);
      if (a !== null && a !== undefined && a !== '') totalAnswered++;
    }
  }
  const avgQuestionsAnswered = respondents
    ? totalAnswered / respondents
    : 0;
  const completionRate = respondents
    ? (avgQuestionsAnswered / PE_QUESTIONS.length) * 100
    : 0;

  let latestResponseAt: string | null = null;
  for (const r of eligible) {
    if (r.booking_date && (!latestResponseAt || r.booking_date > latestResponseAt)) {
      latestResponseAt = r.booking_date;
    }
  }

  return {
    questions,
    stats: {
      responseCount: respondents,
      questionCount: PE_QUESTIONS.length,
      completionRate,
      avgQuestionsAnswered,
      respondents,
      latestResponseAt,
    },
  };
}

// ── CSV ────────────────────────────────────────────────────────────────────

const csvEscape = (v: any) => {
  const s = v == null ? '' : String(v);
  return /[\",\n]/.test(s) ? `"${s.replace(/\"/g, '""')}"` : s;
};

export function buildPaymentExperienceScriptCsv(data: PEScriptData): string {
  const header = [
    'question_number',
    'question_text',
    'question_type',
    'answer_label',
    'count',
    'percentage',
    'response_count',
  ];
  const rows: string[] = [header.join(',')];
  for (const qs of data.questions) {
    const q = qs.question;
    if (q.type === 'open') {
      rows.push(
        [q.order, q.text, q.type, '(open-ended)', qs.count, '', qs.count]
          .map(csvEscape)
          .join(','),
      );
      continue;
    }
    for (const d of qs.distribution) {
      rows.push(
        [q.order, q.text, q.type, d.label, d.count, d.percentage, qs.count]
          .map(csvEscape)
          .join(','),
      );
    }
  }
  return rows.join('\n');
}

export function downloadPaymentExperienceScriptCsv(data: PEScriptData) {
  const csv = buildPaymentExperienceScriptCsv(data);
  const today = new Date().toISOString().slice(0, 10);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `payment-experience-script-responses-${today}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
