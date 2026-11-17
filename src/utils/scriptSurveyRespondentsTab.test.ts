// @ts-nocheck — run with `bun test src/utils/scriptSurveyRespondentsTab.test.ts`
// CR-018 phase 2b: every clickable item in the Script Responses tab opens a panel
// whose respondent count equals the count that card displays.
import { describe, expect, test } from 'bun:test';
import { summarizeScriptQuestion } from './scriptSurveyAnalytics';
import { toPEQuestionSummary } from './scriptSurveyPEAdapter';
import { respondentsForTabItem } from './scriptSurveyRespondents';

const rec = (id, date, answers) => ({ id, booking_id: id, booking_date: date, answers });
const expectAllMatch = (q, rs) => {
  const pe = toPEQuestionSummary(q, summarizeScriptQuestion(q, rs));
  const shown = pe.distribution.filter((d) => d.count > 0);
  expect(shown.length).toBeGreaterThan(0);
  for (const d of shown) expect(respondentsForTabItem(q, rs, d.label).length).toBe(d.count);
  return pe;
};

describe('Script Responses tab: panel count equals displayed count', () => {
  test('multiple choice incl. older format (selected_options string, answer_text)', () => {
    const q = { id: 'q1', order: 1, question: 'Q', type: 'multiple_choice', options: ['Yes', 'No'] };
    const rs = [
      rec('a', '2026-10-01', { q1: { selected_option_labels: ['Yes'] } }),
      rec('b', '2026-10-02', { q1: { selected_options: 'Yes' } }),
      rec('c', '2026-10-03', { q1: { answer_text: 'Maybe later' } }),
      rec('d', '2026-10-04', { q1: { selected_option_labels: ['No'] } }),
    ];
    const pe = expectAllMatch(q, rs);
    expect(pe.distribution.find((d) => d.label === 'Yes').count).toBe(2);
  });
  test('multiple select', () => {
    const q = { id: 'q2', order: 2, question: 'Q', type: 'multiple_select', options: ['A', 'B'] };
    expectAllMatch(q, [rec('a', '2026-10-01', { q2: { selected_option_labels: ['A', 'B'] } }), rec('b', '2026-10-02', { q2: { selected_options: 'A' } })]);
  });
  test('yes/no pills (key yes/no)', () => {
    const q = { id: 'q3', order: 3, question: 'Q', type: 'yes_no', options: ['Yes', 'No'] };
    const rs = [rec('a', '2026-10-01', { q3: { selected_options: 'Yes' } }), rec('b', '2026-10-02', { q3: { selected_option_labels: ['No'] } }), rec('c', '2026-10-03', { q3: { selected_option_labels: ['Yes'] } })];
    const pe = expectAllMatch(q, rs);
    const yes = pe.distribution.find((d) => d.key === 'yes');
    expect(respondentsForTabItem(q, rs, yes.label).length).toBe(yes.count);
    expect(yes.count).toBe(2);
  });
  test('scale', () => {
    const q = { id: 'q4', order: 4, question: 'Q', type: 'scale', scale_min: 1, scale_max: 5 };
    expectAllMatch(q, [rec('a', '2026-10-01', { q4: { scale_value: 4 } }), rec('b', '2026-10-02', { q4: { scale_value: 4.2 } }), rec('c', '2026-10-03', { q4: { scale_value: 2 } })]);
  });
  test('grid row (one card per row question)', () => {
    const q = { id: 'g1', order: 5, question: 'T — R', type: 'multiple_choice', options: ['Yes', 'No'], matrix: { group: 'x', title: 'T', row: 'R' } };
    expectAllMatch(q, [rec('a', '2026-10-01', { g1: { selected_option_labels: ['Yes'] } }), rec('b', '2026-10-02', { g1: { answer_text: 'Kind of' } })]);
  });
});
