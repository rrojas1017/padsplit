// CR-018 phase 2: who gave an answer. Mirrors the normalization used by
// summarizeScriptQuestion / buildGridModel so panel counts equal card counts.
import type { ScriptSurveyQuestion, ScriptSurveyRecord } from '@/hooks/useScriptSurveyResponses';
import { answerLabels, answerScale, answerText, hasAnswerValue } from '@/utils/scriptSurveyAnalytics';
import { GRID_OTHER } from '@/utils/scriptSurveyGrid';

export function sortNewestFirst(records: ScriptSurveyRecord[]): ScriptSurveyRecord[] {
  return [...records].sort((a, b) =>
    a.booking_date === b.booking_date ? (a.booking_id < b.booking_id ? 1 : -1) : a.booking_date < b.booking_date ? 1 : -1);
}

function choiceLabels(q: ScriptSurveyQuestion, r: ScriptSurveyRecord): string[] {
  const e = r.answers[q.id];
  if (q.type === 'multiple_select') return Array.from(new Set(answerLabels(e, q.options)));
  let labels = answerLabels(e, q.options);
  if (!labels.length) { const t = answerText(e); if (t) labels = [t]; }
  return labels;
}

export function respondentsForChoice(q: ScriptSurveyQuestion, records: ScriptSurveyRecord[], label: string): ScriptSurveyRecord[] {
  return sortNewestFirst(records.filter((r) => choiceLabels(q, r).includes(label)));
}

export function respondentsForScale(q: ScriptSurveyQuestion, records: ScriptSurveyRecord[], value: number): ScriptSurveyRecord[] {
  return sortNewestFirst(records.filter((r) => {
    const v = answerScale(r.answers[q.id]);
    return v !== null && Math.round(v) === value;
  }));
}

export function respondentsForGridCell(rowQ: ScriptSurveyQuestion, records: ScriptSurveyRecord[], column: string): ScriptSurveyRecord[] {
  const columns = (rowQ.options || []).map((o) => String(o).trim()).filter(Boolean);
  const keyOf = new Map(columns.map((c) => [c.toLowerCase(), c]));
  return sortNewestFirst(records.filter((r) => {
    const labels = choiceLabels(rowQ, r);
    if (column === GRID_OTHER) return labels.some((l) => !keyOf.has(l.trim().toLowerCase()));
    return labels.some((l) => keyOf.get(l.trim().toLowerCase()) === column);
  }));
}

export interface OpenEndedAnswer { record: ScriptSurveyRecord; text: string }

export function openEndedAnswers(q: ScriptSurveyQuestion, records: ScriptSurveyRecord[]): OpenEndedAnswer[] {
  const out: OpenEndedAnswer[] = [];
  for (const r of sortNewestFirst(records)) {
    const e = r.answers[q.id];
    const text = answerText(e) ?? (hasAnswerValue(e) ? answerLabels(e, q.options).join('; ') || null : null);
    if (text) out.push({ record: r, text });
  }
  return out;
}
