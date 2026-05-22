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

export type PEQuestionType = 'multi' | 'yesno' | 'scale' | 'open' | 'compound';

export interface PEQuestionDef {
  order: number;
  id: string;
  text: string;
  section?: string;
  type: PEQuestionType;
  scaleMin?: number;
  scaleMax?: number;
}

// 1:1 with the PadSplit Member Payment Experience Survey script (16 questions),
// in script order. Each question is rendered from existing `research_extraction`
// fields. Questions whose source field isn't present on older extractions will
// simply show a lower response count — no re-extraction is required.
export const PE_QUESTIONS: PEQuestionDef[] = [
  { order: 1,  id: 'pay_cadence',            text: 'When do you typically get paid?',                                     section: 'Payment literacy baseline',     type: 'multi' },
  { order: 2,  id: 'dues_day_stated',        text: 'What is your payment schedule for your PadSplit room?',               section: 'Payment literacy baseline',     type: 'multi' },
  { order: 3,  id: 'dues_amount_and_amenities', text: 'What is your weekly dues and what amenities or services are included?', section: 'Payment literacy baseline', type: 'compound' },
  { order: 4,  id: 'commitment_stated',       text: 'In your own words, what is your PadSplit stay commitment — and when does it end?', section: 'Payment literacy baseline', type: 'multi' },
  { order: 5,  id: 'reminder_system',        text: 'How do you remember to pay your PadSplit dues each week?',            section: 'Payment habits & behavior',     type: 'open' },
  { order: 6,  id: 'easy_payment_benchmark', text: 'What makes a payment feel easy to you?',                              section: 'Payment habits & behavior',     type: 'open' },
  { order: 7,  id: 'payment_channel',        text: 'Where and how do you typically make your PadSplit payment?',          section: 'Payment habits & behavior',     type: 'multi' },
  { order: 8,  id: 'autopay_enrolled',       text: 'Are you enrolled in auto-pay?',                                       section: 'Friction, confusion & auto-pay', type: 'yesno' },
  { order: 9,  id: 'autopay_barrier',        text: 'What is the primary reason for not enrolling in auto-pay?',           section: 'Friction, confusion & auto-pay', type: 'multi' },
  { order: 10, id: 'move_in_cost_clarity',   text: 'How clear was the total cost to move in? (1–5)',                      section: 'Friction, confusion & auto-pay', type: 'scale', scaleMin: 1, scaleMax: 5 },
  { order: 11, id: 'top_friction_theme',     text: 'What part of the payment process causes the most confusion or frustration?', section: 'Friction, confusion & auto-pay', type: 'multi' },
  { order: 12, id: 'overdue_threshold',      text: "If behind on dues, what's the max overdue amount before PadSplit takes action? (USD)", section: 'Policy awareness & hardship support', type: 'scale', scaleMin: 0, scaleMax: 2000 },
  { order: 13, id: 'hardship_padsplit',      text: "If you couldn't pay on time, what options do you think PadSplit offers?", section: 'Policy awareness & hardship support', type: 'open' },
  { order: 14, id: 'hardship_host',          text: 'What options do you think your host offers if you can\'t pay on time?', section: 'Policy awareness & hardship support', type: 'open' },
  { order: 15, id: 'desired_payment_methods', text: 'Are there any payment methods you wish PadSplit accepted?',          section: 'Payment method capabilities',   type: 'multi' },
  { order: 16, id: 'wish_capability',        text: 'If you could change one thing about how PadSplit payments work, what would it be?', section: 'Recommendations',           type: 'open' },
];

export interface PEDistributionItem {
  key: string;
  label: string;
  count: number;
  percentage: number; // 0..100
}

export interface PEQuestionSummary {
  question: PEQuestionDef;
  count: number;
  distribution: PEDistributionItem[];
  avg?: number;
  min?: number;
  max?: number;
  uniqueAnswers?: number;
  topLabel?: string;
  topCount?: number;
  topPct?: number;
  samples?: string[];
  totalSamples?: number;
  // Compound-question only: child summaries rendered under one parent card.
  // Each sub-summary is itself a regular PEQuestionSummary with its own type
  // (typically 'scale' for the dues amount and 'multi' for amenities).
  subQuestions?: PEQuestionSummary[];
}

export interface PEScriptStats {
  responseCount: number;
  questionCount: number;
  completionRate: number;
  avgQuestionsAnswered: number;
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

const titleCase = (s: string) =>
  s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();

const arrayToVerbatim = (arr: any[]): string | null => {
  const joined = arr
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .join('; ');
  return joined || null;
};

const firstNonEmptyString = (...vals: any[]): string | null => {
  for (const v of vals) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return null;
};

// Returns the answer for this question. For `multi` questions returns
// string[] (one or more keys). For `yesno`/`open` returns string. For
// `scale` returns number. Null/undefined means the record didn't answer.
function getAnswer(rec: PaymentExperienceRecord, q: PEQuestionDef): any {
  const ext: any = rec.extraction || {};
  const breakdown: any = ext.payment_literacy_breakdown || {};
  switch (q.id) {
    case 'pay_cadence': {
      if (ext.pay_cadence == null || String(ext.pay_cadence).trim() === '') return null;
      const norm = lookupNormalized(CADENCE_NORMALIZATION_MAP, ext.pay_cadence);
      return [norm || 'other'];
    }
    case 'dues_day_stated': {
      const v = breakdown.dues_day_stated;
      if (v == null || v === '') return null;
      const s = String(v).toLowerCase().trim();
      const allowed = new Set(['monday','tuesday','wednesday','thursday','friday','saturday','sunday','unknown']);
      return [allowed.has(s) ? s : 'unknown'];
    }
    case 'dues_amount_understanding':
      if (typeof breakdown.dues_amount_correct !== 'boolean') return null;
      return breakdown.dues_amount_correct ? 'yes' : 'no';
    case 'commitment_understanding':
      if (typeof breakdown.commitment_understood !== 'boolean') return null;
      return breakdown.commitment_understood ? 'yes' : 'no';
    case 'reminder_system': {
      // No dedicated extraction field; surface payment_literacy_notes verbatims
      // when present.
      return firstNonEmptyString(ext.payment_literacy_notes);
    }
    case 'easy_payment_benchmark':
      return firstNonEmptyString(ext.easy_payment_benchmark);
    case 'payment_channel': {
      const cm = ext.channel_method;
      if (!cm) return null;
      if (typeof cm === 'string') {
        const v = cm.trim();
        return v ? [v.toLowerCase()] : null;
      }
      const method = firstNonEmptyString(cm.method);
      if (!method) return null;
      return [method.toLowerCase()];
    }
    case 'autopay_enrolled':
      if (ext.autopay_status === 'enrolled') return 'yes';
      if (ext.autopay_status === 'not_enrolled') return 'no';
      return null;
    case 'autopay_barrier': {
      if (ext.autopay_status !== 'not_enrolled') return null;
      const k = lookupNormalized(AUTOPAY_BARRIER_MAP, ext.autopay_barrier_category);
      return k ? [k] : null;
    }
    case 'move_in_cost_clarity':
      return typeof ext.move_in_cost_clarity_1to5 === 'number' ? ext.move_in_cost_clarity_1to5 : null;
    case 'top_friction_theme': {
      const k = lookupNormalized(FRICTION_THEME_MAP, ext.top_friction_theme);
      return k ? [k] : null;
    }
    case 'overdue_threshold': {
      const v = ext.overdue_threshold_belief_usd;
      if (typeof v === 'number' && isFinite(v)) return v;
      const n = Number(v);
      return isFinite(n) && v != null && String(v).trim() !== '' ? n : null;
    }
    case 'hardship_padsplit': {
      const p = ext.hardship_awareness_padsplit;
      if (Array.isArray(p)) return arrayToVerbatim(p) ?? firstNonEmptyString(ext.hardship_details);
      return firstNonEmptyString(p, ext.hardship_details);
    }
    case 'hardship_host': {
      const h = ext.hardship_awareness_host;
      if (Array.isArray(h)) return arrayToVerbatim(h);
      return firstNonEmptyString(h);
    }
    case 'desired_payment_methods': {
      const dpm = ext.desired_payment_methods;
      if (!dpm) return null;
      if (Array.isArray(dpm)) {
        const out = dpm
          .map((x) => String(x ?? '').trim())
          .filter(Boolean)
          .map((x) => x.toLowerCase());
        return out.length ? out : null;
      }
      const s = String(dpm).trim();
      return s ? [s.toLowerCase()] : null;
    }
    case 'wish_capability': {
      const v = firstNonEmptyString(ext.wish_capability, ext.wish_verbatim);
      if (v) return v;
      // wish_capabilities may be an array — join into a single verbatim.
      if (Array.isArray(ext.wish_capabilities)) {
        const joined = ext.wish_capabilities
          .map((x: any) => String(x ?? '').trim())
          .filter(Boolean)
          .join('; ');
        return joined || null;
      }
      return firstNonEmptyString(ext.wish_capabilities);
    }
    default:
      return null;
  }
}

const DAY_LABELS: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
  unknown: 'Unknown',
};

const DAY_ORDER = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday','unknown'];

function labelFor(qId: string, key: string): string {
  if (qId === 'autopay_barrier') return AUTOPAY_BARRIER_LABELS[key] || titleCase(key);
  if (qId === 'pay_cadence') return CADENCE_LABELS[key as keyof typeof CADENCE_LABELS] || titleCase(key);
  if (qId === 'top_friction_theme') return FRICTION_THEME_LABELS[key] || titleCase(key);
  if (qId === 'dues_day_stated') return DAY_LABELS[key] || titleCase(key);
  if (qId === 'autopay_enrolled' || qId === 'dues_amount_understanding' || qId === 'commitment_understanding') {
    return key === 'yes' ? 'Yes' : 'No';
  }
  return titleCase(key);
}

function summarizeQuestion(
  q: PEQuestionDef,
  eligible: PaymentExperienceRecord[],
): PEQuestionSummary {
  // Track per-record whether they answered (for `count`) separately from
  // multi-select totals (a record may contribute multiple option-counts).
  let answeredRecords = 0;
  const numericAnswers: number[] = [];
  const openAnswers: string[] = [];
  const buckets = new Map<string, number>();

  for (const r of eligible) {
    const a = getAnswer(r, q);
    if (a === null || a === undefined || a === '') continue;
    answeredRecords++;
    if (q.type === 'open') {
      openAnswers.push(String(a));
    } else if (q.type === 'scale') {
      if (typeof a === 'number' && isFinite(a)) numericAnswers.push(a);
    } else if (q.type === 'multi') {
      const arr = Array.isArray(a) ? a : [a];
      for (const v of arr) {
        const key = String(v);
        buckets.set(key, (buckets.get(key) || 0) + 1);
      }
    } else if (q.type === 'yesno') {
      const key = String(a);
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }
  }

  if (q.type === 'open') {
    const samples = openAnswers.map((s) => trim(s, 240)).slice(0, 25);
    return {
      question: q,
      count: answeredRecords,
      distribution: [],
      samples,
      totalSamples: answeredRecords,
    };
  }

  if (q.type === 'scale') {
    const nums = numericAnswers;
    const min = q.scaleMin ?? 0;
    const max = q.scaleMax ?? 100;
    const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
    const distribution: PEDistributionItem[] = [];
    if (max - min <= 10) {
      for (let v = min; v <= max; v++) {
        const c = nums.filter((n) => Math.round(n) === v).length;
        distribution.push({ key: String(v), label: String(v), count: c, percentage: pct(c, nums.length) });
      }
    } else {
      const bucketsCount = 10;
      const span = (max - min + 1) / bucketsCount;
      for (let i = 0; i < bucketsCount; i++) {
        const lo = Math.round(min + i * span);
        const hi = i === bucketsCount - 1 ? max : Math.round(min + (i + 1) * span) - 1;
        const c = nums.filter((n) => n >= lo && n <= hi).length;
        distribution.push({
          key: `${lo}-${hi}`,
          label: `${lo}–${hi}`,
          count: c,
          percentage: pct(c, nums.length),
        });
      }
    }
    return { question: q, count: nums.length, distribution, avg, min, max };
  }

  // multi / yesno
  let entries = Array.from(buckets.entries());
  if (q.type === 'yesno') {
    entries = [
      ['yes', buckets.get('yes') || 0],
      ['no', buckets.get('no') || 0],
    ];
  } else if (q.id === 'dues_day_stated') {
    // Force fixed Mon→Sun→Unknown order; only include days that occurred.
    entries = DAY_ORDER
      .filter((d) => (buckets.get(d) || 0) > 0)
      .map((d) => [d, buckets.get(d) || 0] as [string, number]);
  } else {
    entries.sort((a, b) => b[1] - a[1]);
  }
  // For multi questions, percentage denominator is records-that-answered, so
  // overlapping multi-select arrays can sum >100%. For yes/no it's exactly 100%.
  const denom = q.type === 'yesno' ? answeredRecords : answeredRecords;
  const distribution: PEDistributionItem[] = entries.map(([key, c]) => ({
    key,
    label: labelFor(q.id, key),
    count: c,
    percentage: pct(c, denom),
  }));
  const top = [...distribution].sort((a, b) => b.count - a.count).find((d) => d.count > 0);
  return {
    question: q,
    count: answeredRecords,
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

  let totalAnswered = 0;
  for (const r of eligible) {
    for (const q of PE_QUESTIONS) {
      const a = getAnswer(r, q);
      if (a !== null && a !== undefined && a !== '') totalAnswered++;
    }
  }
  const avgQuestionsAnswered = respondents ? totalAnswered / respondents : 0;
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
    'section',
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
        [q.order, q.section || '', q.text, q.type, '(open-ended)', qs.count, '', qs.count]
          .map(csvEscape)
          .join(','),
      );
      continue;
    }
    if (qs.distribution.length === 0) {
      rows.push(
        [q.order, q.section || '', q.text, q.type, '(no responses)', 0, '', qs.count]
          .map(csvEscape)
          .join(','),
      );
      continue;
    }
    for (const d of qs.distribution) {
      rows.push(
        [q.order, q.section || '', q.text, q.type, d.label, d.count, d.percentage, qs.count]
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
