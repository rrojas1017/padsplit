import type { FunnelStep } from '@/utils/paymentExperienceAnalytics';
import type { ScriptSurveyQuestion, ScriptSurveyRecord } from '@/hooks/useScriptSurveyResponses';

export { filterByDateRange } from '@/components/payment-experience/PaymentExperienceInsightsDashboard';

export interface RawAnswerEntry {
  source?: string;
  selected_option_labels?: unknown;
  scale_value?: unknown;
  raw_text_answer?: unknown;
  [k: string]: unknown;
}

export function hasAnswerValue(e: RawAnswerEntry | null | undefined): boolean {
  if (!e || typeof e !== 'object') return false;
  if (Array.isArray(e.selected_option_labels) && e.selected_option_labels.length > 0) return true;
  if (typeof e.scale_value === 'number' && Number.isFinite(e.scale_value)) return true;
  if (typeof e.raw_text_answer === 'string' && e.raw_text_answer.trim() !== '') return true;
  return false;
}

const trim = (s: string, n = 240) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const pct = (num: number, den: number) => (den ? (num / den) * 100 : 0);

export function answerLabels(e: RawAnswerEntry | undefined): string[] {
  if (!e || !Array.isArray(e.selected_option_labels)) return [];
  return e.selected_option_labels.map((x) => String(x).trim()).filter(Boolean);
}
export function answerScale(e: RawAnswerEntry | undefined): number | null {
  return e && typeof e.scale_value === 'number' && Number.isFinite(e.scale_value) ? e.scale_value : null;
}
export function answerText(e: RawAnswerEntry | undefined): string | null {
  return e && typeof e.raw_text_answer === 'string' && e.raw_text_answer.trim() ? e.raw_text_answer.trim() : null;
}

export interface DistributionItem { label: string; count: number; pct: number }
export type ScriptQuestionSummary =
  | { type: 'multiple_choice' | 'yes_no'; count: number; distribution: DistributionItem[] }
  | { type: 'scale'; count: number; avg: number | null; min: number | null; max: number | null; buckets: DistributionItem[] }
  | { type: 'open_ended'; count: number; samples: string[]; allResponses: string[] };

export function summarizeScriptQuestion(q: ScriptSurveyQuestion, eligible: ScriptSurveyRecord[]): ScriptQuestionSummary {
  if (q.type === 'scale') {
    const lo = q.scale_min ?? 1;
    const hi = q.scale_max ?? 5;
    const vals = eligible.map((r) => answerScale(r.answers[q.id])).filter((v): v is number => v !== null);
    const counts = new Map<number, number>();
    for (const v of vals) counts.set(Math.round(v), (counts.get(Math.round(v)) || 0) + 1);
    const buckets: DistributionItem[] = [];
    for (let i = lo; i <= hi; i++) {
      const c = counts.get(i) || 0;
      buckets.push({ label: String(i), count: c, pct: pct(c, vals.length) });
    }
    return {
      type: 'scale',
      count: vals.length,
      avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
      min: vals.length ? Math.min(...vals) : null,
      max: vals.length ? Math.max(...vals) : null,
      buckets,
    };
  }
  if (q.type === 'open_ended') {
    const all = eligible.map((r) => answerText(r.answers[q.id]) ?? (hasAnswerValue(r.answers[q.id]) ? answerLabels(r.answers[q.id]).join('; ') || null : null))
      .filter((v): v is string => !!v);
    return { type: 'open_ended', count: all.length, samples: all.slice(0, 25).map((s) => trim(s)), allResponses: all };
  }
  const counts = new Map<string, number>();
  let answered = 0;
  for (const r of eligible) {
    const e = r.answers[q.id];
    let labels = answerLabels(e);
    if (!labels.length) {
      const t = answerText(e);
      if (t) labels = [t];
    }
    if (!labels.length) continue;
    answered++;
    for (const l of labels) counts.set(l, (counts.get(l) || 0) + 1);
  }
  const distribution = Array.from(counts.entries())
    .map(([label, count]) => ({ label, count, pct: pct(count, answered) }))
    .sort((a, b) => b.count - a.count);
  return { type: q.type, count: answered, distribution };
}

export interface ScriptSurveyStats {
  respondents: number;
  avgQuestionsAnswered: number;
  completionRate: number;
  latestResponseAt: string | null;
  formCount: number;
  recordingCount: number;
  formAndRecordingCount: number;
}

export function deriveScriptSurveyStats(questions: ScriptSurveyQuestion[], eligible: ScriptSurveyRecord[]): ScriptSurveyStats {
  const n = eligible.length;
  const avg = n ? eligible.reduce((a, r) => a + r.answeredCount, 0) / n : 0;
  let latest: string | null = null;
  for (const r of eligible) if (r.booking_date && (!latest || r.booking_date > latest)) latest = r.booking_date;
  return {
    respondents: n,
    avgQuestionsAnswered: avg,
    completionRate: questions.length ? (avg / questions.length) * 100 : 0,
    latestResponseAt: latest,
    formCount: eligible.filter((r) => r.isForm).length,
    recordingCount: eligible.filter((r) => r.hasRecording).length,
    formAndRecordingCount: eligible.filter((r) => r.isForm && r.hasRecording).length,
  };
}

export function computeScriptSurveyFunnel(
  records: ScriptSurveyRecord[],
  validRecords: ScriptSurveyRecord[],
  eligibleRecords: ScriptSurveyRecord[],
  questions: ScriptSurveyQuestion[],
): FunnelStep[] {
  const total = questions.length;
  const half = Math.ceil(total / 2);
  return [
    { id: 'routed', label: 'Routed', count: records.length },
    { id: 'valid', label: 'Valid conversation', count: validRecords.length },
    { id: 'answered-1', label: 'Answered ≥1', count: eligibleRecords.length },
    { id: 'answered-half', label: 'Answered ≥50%', count: total ? eligibleRecords.filter((r) => r.answeredCount >= half).length : 0 },
    { id: 'answered-all', label: 'Answered all', count: total ? eligibleRecords.filter((r) => r.answeredCount >= total).length : 0 },
  ];
}

const csvEscape = (v: any) => {
  const s = v == null ? '' : String(v);
  return /[\",\n]/.test(s) ? `"${s.replace(/\"/g, '""')}"` : s;
};

function cellValue(e: RawAnswerEntry | undefined): string {
  const labels = answerLabels(e);
  if (labels.length) return labels.join('; ');
  const s = answerScale(e);
  if (s !== null) return String(s);
  return answerText(e) ?? '';
}

export function buildScriptSurveyCsv(questions: ScriptSurveyQuestion[], eligible: ScriptSurveyRecord[]): string {
  const header = ['booking_id', 'booking_date', 'has_form', 'has_recording', ...questions.map((q) => `Q${q.order} ${q.question}`)];
  const rows = [header.map(csvEscape).join(',')];
  for (const r of eligible) {
    rows.push(
      [r.booking_id, r.booking_date, r.isForm ? 'yes' : 'no', r.hasRecording ? 'yes' : 'no', ...questions.map((q) => cellValue(r.answers[q.id]))]
        .map(csvEscape).join(','),
    );
  }
  return rows.join('\n');
}
