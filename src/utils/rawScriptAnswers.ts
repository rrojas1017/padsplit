// src/utils/rawScriptAnswers.ts
// Shared helper for building durable, normalized raw answer records that we
// persist into `booking_transcriptions.research_extraction.raw_script_answers`.
// This file is pure (no Supabase imports) so it can be tree-shaken into both
// the agent runtime and the script builder.

export type RawScriptAnswerSource = 'agent_runtime' | 'ai_extraction';

export type RawScriptAnswerQuestionType =
  | 'multiple_choice'
  | 'multiple_select'
  | 'yes_no'
  | 'scale'
  | 'open_ended';

export interface RawScriptAnswer {
  question_id: string;
  question_text: string;
  ai_hint?: string | null;
  question_type: RawScriptAnswerQuestionType;
  selected_option_labels?: string[];
  raw_text_answer?: string | null;
  scale_value?: number | null;
  answered_at?: string | null;
  source: RawScriptAnswerSource;
}

/** Loose script question shape — matches both Script Builder and Live Agent runtime questions. */
export interface RawAnswerScriptQuestion {
  id?: string | number;
  order?: number;
  text?: string;
  question?: string;
  type: string;
  options?: string[];
  ai_extraction_hint?: string;
}

export interface BuildRawScriptAnswersOpts {
  source?: RawScriptAnswerSource;
  answeredAt?: string;
}

const isEmpty = (v: unknown): boolean => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  return false;
};

export function getQuestionStableId(q: RawAnswerScriptQuestion, fallbackIndex: number): string {
  if (q.id !== undefined && q.id !== null && String(q.id).trim() !== '') return String(q.id);
  return `q_idx_${fallbackIndex}`;
}

/**
 * Build the `raw_script_answers` map from script questions + a responses object.
 * Responses may be keyed by question.id (preferred) or by array index — we try
 * both. Skips unanswered questions.
 */
export function buildRawScriptAnswers(
  questions: RawAnswerScriptQuestion[],
  responses: Record<string, unknown> | Record<number, unknown> | null | undefined,
  opts: BuildRawScriptAnswersOpts = {},
): Record<string, RawScriptAnswer> {
  const out: Record<string, RawScriptAnswer> = {};
  if (!Array.isArray(questions) || !responses) return out;

  const source = opts.source ?? 'agent_runtime';
  const answeredAt = opts.answeredAt ?? new Date().toISOString();
  const respMap = responses as Record<string, unknown>;

  questions.forEach((q, idx) => {
    if (!q) return;
    const stableId = getQuestionStableId(q, idx);
    // Look up the answer by stable id, raw id, or array index.
    let answer: unknown =
      respMap[stableId] ??
      (q.id !== undefined ? respMap[String(q.id)] : undefined) ??
      respMap[idx as unknown as string] ??
      respMap[String(idx)];

    if (isEmpty(answer)) return;

    const base: RawScriptAnswer = {
      question_id: stableId,
      question_text: String(q.question ?? q.text ?? '').trim(),
      ai_hint: q.ai_extraction_hint ?? null,
      question_type: 'open_ended',
      answered_at: answeredAt,
      source,
    };

    switch (q.type) {
      case 'multiple_choice': {
        const label = String(answer).trim();
        if (!label) return;
        base.question_type = 'multiple_choice';
        base.selected_option_labels = [label];
        break;
      }
      case 'multiple_select': {
        const labels = (Array.isArray(answer) ? answer : [answer])
          .map((x) => String(x ?? '').trim())
          .filter(Boolean);
        if (labels.length === 0) return;
        base.question_type = 'multiple_select';
        base.selected_option_labels = labels;
        break;
      }
      case 'yes_no': {
        const v = String(answer).trim().toLowerCase();
        if (!v) return;
        const label = v.startsWith('y') ? 'Yes' : v.startsWith('n') ? 'No' : null;
        if (!label) return;
        base.question_type = 'yes_no';
        base.selected_option_labels = [label];
        break;
      }
      case 'scale': {
        const n = typeof answer === 'number' ? answer : Number(answer);
        if (!Number.isFinite(n)) return;
        base.question_type = 'scale';
        base.scale_value = n;
        break;
      }
      case 'open_ended':
      default: {
        const text = String(answer ?? '').trim();
        if (!text) return;
        base.question_type = 'open_ended';
        base.raw_text_answer = text;
      }
    }

    out[stableId] = base;
  });

  return out;
}

/** Safe getter for downstream dashboard utilities. */
export function getRawScriptAnswer(
  extraction: unknown,
  questionId: string,
): RawScriptAnswer | null {
  if (!extraction || typeof extraction !== 'object') return null;
  const raw = (extraction as Record<string, unknown>).raw_script_answers;
  if (!raw || typeof raw !== 'object') return null;
  const entry = (raw as Record<string, unknown>)[questionId];
  if (!entry || typeof entry !== 'object') return null;
  return entry as RawScriptAnswer;
}

/** Generate a new stable question id for Script Builder. */
export function generateQuestionId(): string {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return `q_${uuid.replace(/-/g, '').slice(0, 8)}`;
}

/** Ensure every question has a stable string id; preserves existing ids. */
export function ensureQuestionIds<T extends RawAnswerScriptQuestion>(questions: T[] | null | undefined): T[] {
  if (!Array.isArray(questions)) return [];
  return questions.map((q) => {
    if (!q) return q;
    if (q.id !== undefined && q.id !== null && String(q.id).trim() !== '') return q;
    return { ...q, id: generateQuestionId() };
  });
}
