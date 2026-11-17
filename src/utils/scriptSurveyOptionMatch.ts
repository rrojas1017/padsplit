// CR-019: one rule for "does this answer match an option?". Pure, no React.
// MATCHED = trimmed, case-insensitive equal to an English option, or to the
// Spanish option at the same position. Everything else is UNMATCHED ("Other").
import type { ScriptSurveyQuestion, ScriptSurveyRecord } from '@/hooks/useScriptSurveyResponses';
import { answerLabels, answerText, type RawAnswerEntry } from '@/utils/scriptSurveyAnalytics';

export const OTHER_LABEL = 'Other';
const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();

export function isChoiceWithOptions(q: Pick<ScriptSurveyQuestion, 'type' | 'options'>): boolean {
  return (q.type === 'multiple_choice' || q.type === 'multiple_select' || q.type === 'yes_no')
    && (q.options || []).some((o) => String(o).trim() !== '');
}

export function matchOption(q: Pick<ScriptSurveyQuestion, 'options' | 'options_es'>, label: string): string | null {
  const v = norm(label);
  if (!v) return null;
  const en = q.options || [];
  const i = en.findIndex((o) => norm(o) === v);
  if (i >= 0) return String(en[i]).trim();
  const es = q.options_es || [];
  const j = es.findIndex((o) => norm(o) === v);
  if (j >= 0 && en[j] != null && String(en[j]).trim()) return String(en[j]).trim();
  return null;
}

/** Raw labels the record gave, before matching (same extraction as the cards). */
export function rawChoiceLabels(q: ScriptSurveyQuestion, e: RawAnswerEntry | undefined): string[] {
  let labels = answerLabels(e);
  if (!labels.length && q.type !== 'multiple_select') { const t = answerText(e); if (t) labels = [t]; }
  return labels;
}

export function splitAnswerLabels(q: ScriptSurveyQuestion, e: RawAnswerEntry | undefined): { matched: string[]; unmatched: string[] } {
  const matched: string[] = [];
  const unmatched: string[] = [];
  for (const l of rawChoiceLabels(q, e)) {
    const m = matchOption(q, l);
    if (m) { if (!matched.includes(m)) matched.push(m); } else if (!unmatched.includes(l)) unmatched.push(l);
  }
  // A literal "Other" option absorbs unmatched answers (no duplicate row names).
  const otherOpt = (q.options || []).map((o) => String(o).trim()).find((o) => norm(o) === norm(OTHER_LABEL));
  if (otherOpt && unmatched.length && !matched.includes(otherOpt)) matched.push(otherOpt);
  return { matched, unmatched };
}

/** Labels a record counts under on the cards (option names, plus OTHER_LABEL). */
export function displayLabels(q: ScriptSurveyQuestion, e: RawAnswerEntry | undefined): string[] {
  const { matched, unmatched } = splitAnswerLabels(q, e);
  const hasOtherOpt = matched.some((m) => norm(m) === norm(OTHER_LABEL));
  return unmatched.length && !hasOtherOpt ? [...matched, OTHER_LABEL] : matched;
}

export function unmatchedAnswerText(q: ScriptSurveyQuestion, r: ScriptSurveyRecord): string | null {
  if (!isChoiceWithOptions(q)) return null;
  const u = splitAnswerLabels(q, r.answers[q.id]).unmatched;
  return u.length ? u.join('; ') : null;
}
