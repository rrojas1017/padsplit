// @ts-nocheck — run with `bun test src/hooks/useResearchCallAnswers.test.ts`
import { describe, expect, test, mock } from 'bun:test';
mock.module('@/integrations/supabase/client', () => ({ supabase: {} }));
const { buildAnswerGroups } = await import('./useResearchCallAnswers');

const qs = [
  { id: 'q1', question: 'Did you book?', type: 'multiple_choice', options: ['Yes', 'No'] },
  { id: 'q2', question: 'Why not?', type: 'open_ended' },
];
const answers = (g) => g.flatMap((x) => x.items.map((i) => i.answer));

describe('buildAnswerGroups', () => {
  test('map entries without question_id match by map key', () => {
    const raw = { q1: { selected_options: ['Yes'] }, q2: { answer_text: 'Too far' } };
    expect(answers(buildAnswerGroups(qs, raw))).toEqual(['Yes', 'Too far']);
  });
  test('no script: map key used as label', () => {
    const raw = { q1: { selected_options: ['Yes'] }, q2: { answer_text: 'Too far' } };
    expect(buildAnswerGroups(null, raw)[0].items.map((i) => i.label)).toEqual(['q1', 'q2']);
  });
  test('map key wins over question_id', () => {
    const raw = { q1: { question_id: 'q2', selected_options: ['No'] } };
    expect(answers(buildAnswerGroups(qs, raw))[0]).toBe('No');
  });
  test('arrays still match by question_id', () => {
    const raw = [{ question_id: 'q2', answer_text: 'Price' }];
    expect(answers(buildAnswerGroups(qs, raw))[1]).toBe('Price');
  });
});
