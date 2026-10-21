// CR-013 D: grid (matrix) grouping + per-row stacked model for the per-script
// survey dashboard and Word brief. Pure helpers, no React.
import type { ScriptSurveyQuestion, ScriptSurveyRecord } from '@/hooks/useScriptSurveyResponses';
import { getMatrixBlock } from '@/utils/scriptMatrix';
import { summarizeScriptQuestion } from '@/utils/scriptSurveyAnalytics';

export type SurveyBlock =
  | { kind: 'single'; q: ScriptSurveyQuestion }
  | { kind: 'grid'; group: string; title: string; rows: ScriptSurveyQuestion[] };

/** Consecutive valid matrix rows sharing a group become one grid block; everything else stays single. */
export function groupSurveyBlocks(questions: ScriptSurveyQuestion[]): SurveyBlock[] {
  const out: SurveyBlock[] = [];
  let i = 0;
  while (i < questions.length) {
    const b = getMatrixBlock(questions as any, i);
    if (b) {
      const rows = questions.slice(b.start, b.end + 1);
      const first = rows[0];
      out.push({ kind: 'grid', group: b.group, title: first.matrix?.title || first.question, rows });
      i = b.end + 1;
    } else {
      out.push({ kind: 'single', q: questions[i] });
      i++;
    }
  }
  return out;
}

export interface GridSegment { label: string; count: number; pct: number }
export interface GridRowModel { id: string; label: string; n: number; segments: GridSegment[] }
export interface GridModel { title: string; columns: string[]; hasOther: boolean; rows: GridRowModel[] }

export const GRID_OTHER = 'Other';

export function buildGridModel(block: Extract<SurveyBlock, { kind: 'grid' }>, eligible: ScriptSurveyRecord[]): GridModel {
  const columns = (block.rows[0].options || []).map((o) => String(o).trim()).filter(Boolean);
  const keyOf = new Map(columns.map((c) => [c.toLowerCase(), c]));
  let hasOther = false;
  const rows: GridRowModel[] = block.rows.map((q) => {
    const s = summarizeScriptQuestion(q, eligible);
    const counts = new Map<string, number>(columns.map((c) => [c, 0]));
    let other = 0;
    const n = s.count;
    if (s.type === 'multiple_choice' || s.type === 'yes_no' || s.type === 'multiple_select') {
      for (const d of s.distribution) {
        const col = keyOf.get(d.label.trim().toLowerCase());
        if (col) counts.set(col, (counts.get(col) || 0) + d.count);
        else other += d.count;
      }
    }
    if (other > 0) hasOther = true;
    const p = (c: number) => (n > 0 ? (c / n) * 100 : 0);
    const segments = columns.map((c) => ({ label: c, count: counts.get(c) || 0, pct: p(counts.get(c) || 0) }));
    if (other > 0) segments.push({ label: GRID_OTHER, count: other, pct: p(other) });
    return { id: q.id, label: q.matrix?.row || q.question, n, segments };
  });
  if (hasOther) {
    for (const r of rows) if (!r.segments.some((s) => s.label === GRID_OTHER)) r.segments.push({ label: GRID_OTHER, count: 0, pct: 0 });
  }
  return { title: block.title, columns: hasOther ? [...columns, GRID_OTHER] : columns, hasOther, rows };
}
