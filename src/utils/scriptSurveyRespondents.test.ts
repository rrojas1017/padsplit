// @ts-nocheck — run with `bun test src/utils/scriptSurveyRespondents.test.ts`
import { describe, expect, test } from 'bun:test';
import { summarizeScriptQuestion } from './scriptSurveyAnalytics';
import { buildGridModel } from './scriptSurveyGrid';
import { openEndedAnswers, respondentsForChoice, respondentsForGridCell, respondentsForScale } from './scriptSurveyRespondents';

const rec = (id, date, answers) => ({ id, booking_id: id, booking_date: date, answers });

describe('respondent counts equal card counts', () => {
  test('multiple choice incl. older format (selected_options string)', () => {
    const q = { id: 'q1', order: 1, question: 'Q', type: 'multiple_choice', options: ['Yes', 'No'] };
    const rs = [
      rec('a', '2026-10-01', { q1: { selected_option_labels: ['Yes'] } }),
      rec('b', '2026-10-02', { q1: { selected_options: ['yes'] } }),
      rec('c', '2026-10-03', { q1: { selected_options: 'Yes' } }),
      rec('d', '2026-10-04', { q1: { selected_option_labels: ['No'] } }),
    ];
    const s = summarizeScriptQuestion(q, rs);
    const yes = s.distribution.find((d) => d.label === 'Yes').count;
    const who = respondentsForChoice(q, rs, 'Yes');
    expect(who.length).toBe(yes);
    expect(yes).toBe(3);
    expect(who[0].booking_id).toBe('c'); // newest first
  });
  test('multi-select', () => {
    const q = { id: 'q2', order: 1, question: 'Q', type: 'multiple_select', options: ['A', 'B'] };
    const rs = [rec('a', '2026-10-01', { q2: { selected_option_labels: ['A', 'B'] } }), rec('b', '2026-10-02', { q2: { selected_option_labels: ['A'] } })];
    const s = summarizeScriptQuestion(q, rs);
    expect(respondentsForChoice(q, rs, 'A').length).toBe(s.distribution.find((d) => d.label === 'A').count);
  });
  test('scale', () => {
    const q = { id: 'q3', order: 1, question: 'Q', type: 'scale', scale_min: 1, scale_max: 5 };
    const rs = [rec('a', '2026-10-01', { q3: { scale_value: 4 } }), rec('b', '2026-10-02', { q3: { scale_value: 4.2 } }), rec('c', '2026-10-02', { q3: { scale_value: 2 } })];
    const s = summarizeScriptQuestion(q, rs);
    expect(respondentsForScale(q, rs, 4).length).toBe(s.buckets.find((b) => b.label === '4').count);
  });
  test('grid cell incl. Other', () => {
    const row = { id: 'g1', order: 1, question: 'T — R', type: 'multiple_choice', options: ['Yes', 'No'], matrix: { group: 'x', title: 'T', row: 'R' } };
    const rs = [rec('a', '2026-10-01', { g1: { selected_option_labels: ['Yes'] } }), rec('b', '2026-10-02', { g1: { answer_text: 'Kind of' } })];
    const m = buildGridModel({ kind: 'grid', group: 'x', title: 'T', rows: [row] }, rs);
    for (const seg of m.rows[0].segments) expect(respondentsForGridCell(row, rs, seg.label).length).toBe(seg.count);
  });
  test('open-ended incl. older answer_text', () => {
    const q = { id: 'q4', order: 1, question: 'Q', type: 'open_ended' };
    const rs = [rec('a', '2026-10-01', { q4: { raw_text_answer: 'hi' } }), rec('b', '2026-10-02', { q4: { answer_text: 'yo' } })];
    expect(openEndedAnswers(q, rs).length).toBe(summarizeScriptQuestion(q, rs).count);
  });
});
