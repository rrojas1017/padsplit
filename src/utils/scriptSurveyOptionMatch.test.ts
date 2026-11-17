// @ts-nocheck — run with `bun test src/utils/scriptSurveyOptionMatch.test.ts`
// CR-019: unmatched answers are grouped under "Other"; panel counts equal card counts.
import { describe, expect, test } from 'bun:test';
import { summarizeScriptQuestion } from './scriptSurveyAnalytics';
import { buildGridModel, GRID_OTHER } from './scriptSurveyGrid';
import { toPEQuestionSummary } from './scriptSurveyPEAdapter';
import { matchOption, OTHER_LABEL } from './scriptSurveyOptionMatch';
import { respondentsForGridCell, respondentsForTabItem, unmatchedAnswerText } from './scriptSurveyRespondents';

const rec = (id, date, answers) => ({ id, booking_id: id, booking_date: date, answers });
const LONG = 'well my cousin told me about it when we were at the store last week and';
const allMatch = (q, rs) => {
  const s = summarizeScriptQuestion(q, rs);
  for (const d of s.distribution.filter((x) => x.count > 0)) expect(respondentsForTabItem(q, rs, d.label).length).toBe(d.count);
  return s;
};

describe('CR-019 Other grouping', () => {
  test('matchOption: case-insensitive English and positional Spanish', () => {
    const q = { options: ['Friend', 'Online ad'], options_es: ['Amigo', 'Anuncio en línea'] };
    expect(matchOption(q, ' friend ')).toBe('Friend');
    expect(matchOption(q, 'anuncio en LÍNEA')).toBe('Online ad');
    expect(matchOption(q, LONG)).toBeNull();
  });
  test('single choice: unmatched sentence → Other, last, sums to 100%', () => {
    const q = { id: 'h', order: 1, question: 'How did you hear?', type: 'multiple_choice', options: ['Friend', 'Online ad'], options_es: ['Amigo', 'Anuncio'] };
    const rs = [
      rec('a', '2026-10-01', { h: { selected_option_labels: ['Friend'] } }),
      rec('b', '2026-10-02', { h: { selected_option_labels: ['Amigo'] } }),
      rec('c', '2026-10-03', { h: { answer_text: LONG } }),
      rec('d', '2026-10-04', { h: { selected_options: 'online AD' } }),
    ];
    const s = allMatch(q, rs);
    expect(s.distribution.map((d) => [d.label, d.count])).toEqual([['Friend', 2], ['Online ad', 1], [OTHER_LABEL, 1]]);
    expect(Math.round(s.distribution.reduce((a, d) => a + d.pct, 0))).toBe(100);
    expect(unmatchedAnswerText(q, rs[2])).toBe(LONG);
    expect(unmatchedAnswerText(q, rs[0])).toBeNull();
  });
  test('multi-select: one matched + one unmatched counts in both, base = respondents', () => {
    const q = { id: 'm', order: 2, question: 'Q', type: 'multiple_select', options: ['A', 'B'] };
    const rs = [rec('a', '2026-10-01', { m: { selected_option_labels: ['A', 'something else'] } }), rec('b', '2026-10-02', { m: { selected_option_labels: ['A'] } })];
    const s = allMatch(q, rs);
    expect(s.count).toBe(2);
    expect(s.distribution.find((d) => d.label === 'A').pct).toBe(100);
    expect(s.distribution.at(-1)).toEqual({ label: OTHER_LABEL, count: 1, pct: 50 });
    expect(s.distribution.find((d) => d.label === 'B').count).toBe(0);
  });
  test('yes/no with an unmatched answer; tab item counts match', () => {
    const q = { id: 'y', order: 3, question: 'Q', type: 'yes_no', options: ['Yes', 'No'], options_es: ['Sí', 'No'] };
    const rs = [rec('a', '2026-10-01', { y: { selected_option_labels: ['Sí'] } }), rec('b', '2026-10-02', { y: { answer_text: 'it depends' } }), rec('c', '2026-10-03', { y: { selected_options: 'No' } })];
    allMatch(q, rs);
    const pe = toPEQuestionSummary(q, summarizeScriptQuestion(q, rs));
    expect(pe.distribution.find((d) => d.key === 'yes').count).toBe(1);
    expect(pe.distribution.find((d) => d.label === OTHER_LABEL).count).toBe(1);
  });
  test('no options → untouched (raw labels stay rows)', () => {
    const q = { id: 'n', order: 4, question: 'Q', type: 'multiple_choice' };
    const s = summarizeScriptQuestion(q, [rec('a', '2026-10-01', { n: { answer_text: 'free' } })]);
    expect(s.distribution[0].label).toBe('free');
  });
  test('grid Other uses the same rule (Spanish counts in its column)', () => {
    const row = { id: 'g', order: 5, question: 'T — R', type: 'multiple_choice', options: ['Yes', 'No'], options_es: ['Sí', 'No'], matrix: { group: 'x', title: 'T', row: 'R' } };
    const rs = [rec('a', '2026-10-01', { g: { selected_option_labels: ['Sí'] } }), rec('b', '2026-10-02', { g: { answer_text: 'Kind of' } })];
    const m = buildGridModel({ kind: 'grid', group: 'x', title: 'T', rows: [row] }, rs);
    for (const seg of m.rows[0].segments) expect(respondentsForGridCell(row, rs, seg.label).length).toBe(seg.count);
    expect(m.rows[0].segments.find((x) => x.label === 'Yes').count).toBe(1);
    expect(m.rows[0].segments.find((x) => x.label === GRID_OTHER).count).toBe(1);
  });
  test('grid with a literal "Other" option: picked Other + unmatched both count', () => {
    const row = { id: 'go', order: 6, question: 'T — R', type: 'multiple_choice', options: ['Yes', 'No', 'Other'], matrix: { group: 'x', title: 'T', row: 'R' } };
    const rs = [
      rec('a', '2026-10-01', { go: { selected_option_labels: ['Other'] } }),
      rec('b', '2026-10-02', { go: { answer_text: 'Kind of' } }),
      rec('c', '2026-10-03', { go: { selected_option_labels: ['Yes'] } }),
    ];
    const m = buildGridModel({ kind: 'grid', group: 'x', title: 'T', rows: [row] }, rs);
    for (const seg of m.rows[0].segments) expect(respondentsForGridCell(row, rs, seg.label).length).toBe(seg.count);
    expect(m.rows[0].segments.find((x) => x.label === GRID_OTHER).count).toBe(2);
    expect(unmatchedAnswerText(row, rs[1])).toBe('Kind of');
    expect(unmatchedAnswerText(row, rs[0])).toBeNull();
  });
});
