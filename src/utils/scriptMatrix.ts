// CR-013: grid ("matrix") questions. A grid is N consecutive multiple_choice
// rows sharing the same options and matrix.group. Pure helpers only.

export interface MatrixInfo { group: string; title: string; row: string }

export interface MatrixLikeQuestion {
  id?: string | number;
  order?: number;
  question?: string;
  text?: string;
  type: string;
  options?: string[];
  matrix?: MatrixInfo;
  branch?: unknown;
  required?: boolean;
  section?: string;
  ai_extraction_hint?: string;
}

export const MATRIX_DEFAULT_COLUMNS = ['Yes', 'Maybe', 'No'];

export function isValidMatrixRow(q: MatrixLikeQuestion | null | undefined): boolean {
  return !!q && q.type === 'multiple_choice' && !!q.matrix &&
    typeof q.matrix.group === 'string' && q.matrix.group.trim() !== '' &&
    Array.isArray(q.options) && q.options.length >= 2;
}

export interface MatrixBlock { start: number; end: number; group: string }

export function getMatrixBlock(questions: MatrixLikeQuestion[] | null | undefined, index: number): MatrixBlock | null {
  if (!Array.isArray(questions)) return null;
  const q = questions[index];
  if (!isValidMatrixRow(q)) return null;
  const group = q!.matrix!.group;
  const same = (i: number) => isValidMatrixRow(questions[i]) && questions[i].matrix!.group === group;
  let start = index;
  while (start > 0 && same(start - 1)) start--;
  let end = index;
  while (end < questions.length - 1 && same(end + 1)) end++;
  return { start, end, group };
}

export function snapToBlockStart(questions: MatrixLikeQuestion[] | null | undefined, index: number): number {
  const b = getMatrixBlock(questions, index);
  return b ? b.start : index;
}

export function matrixQuestionText(title: string, row: string): string {
  return `${(title || '').trim()} — ${(row || '').trim()}`;
}

export function newMatrixGroup(): string {
  return 'g_' + Math.random().toString(36).slice(2, 10).padEnd(8, '0');
}

export type EditorBlock = { kind: 'single'; index: number } | { kind: 'grid'; start: number; end: number };

export function groupEditorBlocks(questions: MatrixLikeQuestion[]): EditorBlock[] {
  const out: EditorBlock[] = [];
  let i = 0;
  while (i < questions.length) {
    const b = getMatrixBlock(questions, i);
    if (b) { out.push({ kind: 'grid', start: b.start, end: b.end }); i = b.end + 1; }
    else { out.push({ kind: 'single', index: i }); i++; }
  }
  return out;
}

// ── Editor operations (all return a new, renumbered array) ──

const renumber = <T extends MatrixLikeQuestion>(qs: T[]): T[] => qs.map((q, i) => ({ ...q, order: i + 1 }));

export function createGridRows<T extends MatrixLikeQuestion>(newId: () => string, base: Partial<T> = {}): T[] {
  const group = newMatrixGroup();
  const title = 'New grid question';
  return [1, 2, 3].map((n) => ({
    ...base,
    id: newId(),
    type: 'multiple_choice',
    options: [...MATRIX_DEFAULT_COLUMNS],
    required: true,
    ai_extraction_hint: '',
    matrix: { group, title, row: `Row ${n}` },
    question: matrixQuestionText(title, `Row ${n}`),
  } as unknown as T));
}

export function appendGrid<T extends MatrixLikeQuestion>(qs: T[], newId: () => string, base: Partial<T> = {}): T[] {
  return renumber([...qs, ...createGridRows<T>(newId, base)]);
}

function mapBlock<T extends MatrixLikeQuestion>(qs: T[], start: number, end: number, fn: (q: T) => T): T[] {
  return renumber(qs.map((q, i) => (i >= start && i <= end ? fn(q) : q)));
}

export function setGridTitle<T extends MatrixLikeQuestion>(qs: T[], start: number, end: number, title: string): T[] {
  return mapBlock(qs, start, end, (q) => ({ ...q, matrix: { ...q.matrix!, title }, question: matrixQuestionText(title, q.matrix!.row) }));
}

export function setGridColumns<T extends MatrixLikeQuestion>(qs: T[], start: number, end: number, options: string[]): T[] {
  return mapBlock(qs, start, end, (q) => ({ ...q, options: [...options] }));
}

export function setGridField<T extends MatrixLikeQuestion>(qs: T[], start: number, end: number, updates: Partial<T>): T[] {
  return mapBlock(qs, start, end, (q) => ({ ...q, ...updates }));
}

export function renameGridRow<T extends MatrixLikeQuestion>(qs: T[], index: number, row: string): T[] {
  return renumber(qs.map((q, i) => (i === index ? { ...q, matrix: { ...q.matrix!, row }, question: matrixQuestionText(q.matrix!.title, row) } : q)));
}

export function setRowHint<T extends MatrixLikeQuestion>(qs: T[], index: number, hint: string): T[] {
  return qs.map((q, i) => (i === index ? { ...q, ai_extraction_hint: hint } : q));
}

export function addGridRow<T extends MatrixLikeQuestion>(qs: T[], start: number, end: number, newId: () => string): T[] {
  const first = qs[start];
  const row = `Row ${end - start + 2}`;
  const nq = {
    ...first,
    id: newId(),
    ai_extraction_hint: '',
    branch: undefined,
    matrix: { ...first.matrix!, row },
    question: matrixQuestionText(first.matrix!.title, row),
  } as T;
  const out = [...qs];
  out.splice(end + 1, 0, nq);
  return renumber(out);
}

export function removeGridRow<T extends MatrixLikeQuestion>(qs: T[], index: number): T[] {
  return renumber(qs.filter((_, i) => i !== index));
}

export function moveGridRow<T extends MatrixLikeQuestion>(qs: T[], start: number, end: number, index: number, dir: 'up' | 'down'): T[] {
  const to = dir === 'up' ? index - 1 : index + 1;
  if (to < start || to > end) return qs;
  const out = [...qs];
  [out[index], out[to]] = [out[to], out[index]];
  return renumber(out);
}

export function removeBlock<T extends MatrixLikeQuestion>(qs: T[], start: number, end: number): T[] {
  return renumber(qs.filter((_, i) => i < start || i > end));
}

/** Move the block [start..end] past the neighbouring editor block. */
export function moveBlock<T extends MatrixLikeQuestion>(qs: T[], start: number, end: number, dir: 'up' | 'down'): T[] {
  const blocks = groupEditorBlocks(qs);
  const idx = blocks.findIndex((b) => (b.kind === 'grid' ? b.start : b.index) === start);
  const to = dir === 'up' ? idx - 1 : idx + 1;
  if (idx < 0 || to < 0 || to >= blocks.length) return qs;
  const span = (b: EditorBlock) => (b.kind === 'grid' ? qs.slice(b.start, b.end + 1) : [qs[b.index]]);
  const order = blocks.map(span);
  [order[idx], order[to]] = [order[to], order[idx]];
  void end;
  return renumber(order.flat());
}

export function duplicateBlock<T extends MatrixLikeQuestion>(qs: T[], start: number, end: number, newId: () => string): T[] {
  const group = newMatrixGroup();
  const copy = qs.slice(start, end + 1).map((q) => ({ ...q, id: newId(), matrix: { ...q.matrix!, group } }));
  const out = [...qs];
  out.splice(end + 1, 0, ...copy);
  return renumber(out);
}

/** Save-time cleanup: keep matrix only on multiple_choice; rows with matrix lose branch. */
export function cleanMatrixForSave<T extends MatrixLikeQuestion>(q: T): T {
  if (q.type !== 'multiple_choice') {
    if (q.matrix === undefined) return q;
    const { matrix: _m, ...rest } = q;
    return rest as T;
  }
  if (q.matrix) {
    const { branch: _b, ...rest } = q;
    return rest as T;
  }
  return q;
}

/** Translation: keep matrix on translated questions, force group from source. */
export function alignMatrix(tq: any, sq: any): any {
  if (!sq?.matrix) return tq;
  const tm = tq?.matrix && typeof tq.matrix === 'object' ? tq.matrix : {};
  return {
    ...tq,
    matrix: {
      ...sq.matrix,
      title: tm.title || sq.matrix.title,
      row: tm.row || sq.matrix.row,
      group: sq.matrix.group,
    },
  };
}
