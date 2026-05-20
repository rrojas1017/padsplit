import type { ScriptQuestion } from '@/hooks/useResearchScripts';

export type NextStep = number | 'closing';

interface Args {
  currentIndex: number;
  question: ScriptQuestion | undefined | null;
  answer: unknown;
  questionsLength: number;
}

const linearFallback = (currentIndex: number, questionsLength: number): NextStep => {
  const next = currentIndex + 1;
  if (next >= questionsLength) return 'closing';
  return next;
};

const resolveGoto = (
  goto: number | undefined | null,
  currentIndex: number,
  questionsLength: number,
): NextStep | null => {
  if (goto === undefined || goto === null) return null;
  const n = Number(goto);
  if (!Number.isFinite(n)) return null;
  if (n === 0) return 'closing';
  const idx = Math.floor(n) - 1; // 1-based → 0-based
  if (idx < 0 || idx >= questionsLength) return null;
  if (idx === currentIndex) return null; // no self-loop
  return idx;
};

export function resolveNextQuestionIndex({
  currentIndex,
  question,
  answer,
  questionsLength,
}: Args): NextStep {
  try {
    if (!question || !question.branch) {
      return linearFallback(currentIndex, questionsLength);
    }
    const branch = question.branch;

    if (question.type === 'yes_no') {
      const norm = String(answer ?? '').trim().toLowerCase();
      let goto: number | undefined;
      if (norm === 'yes' || norm === 'true' || norm === 'y') goto = branch.yes_goto;
      else if (norm === 'no' || norm === 'false' || norm === 'n') goto = branch.no_goto;
      const resolved = resolveGoto(goto, currentIndex, questionsLength);
      return resolved ?? linearFallback(currentIndex, questionsLength);
    }

    if (question.type === 'scale') {
      const num = Number(answer);
      const threshold = Number(branch.scale_threshold);
      if (!Number.isFinite(num) || !Number.isFinite(threshold)) {
        return linearFallback(currentIndex, questionsLength);
      }
      const goto = num <= threshold ? branch.scale_lte_goto : branch.scale_gt_goto;
      const resolved = resolveGoto(goto, currentIndex, questionsLength);
      return resolved ?? linearFallback(currentIndex, questionsLength);
    }

    if (question.type === 'multiple_choice') {
      const map = branch.option_gotos;
      if (!map || typeof map !== 'object') {
        return linearFallback(currentIndex, questionsLength);
      }
      const ansStr = String(answer ?? '');
      let goto = map[ansStr];
      if (goto === undefined) {
        const norm = ansStr.trim().toLowerCase();
        const key = Object.keys(map).find(k => k.trim().toLowerCase() === norm);
        if (key !== undefined) goto = map[key];
      }
      const resolved = resolveGoto(goto, currentIndex, questionsLength);
      return resolved ?? linearFallback(currentIndex, questionsLength);
    }

    return linearFallback(currentIndex, questionsLength);
  } catch {
    return linearFallback(currentIndex, questionsLength);
  }
}
