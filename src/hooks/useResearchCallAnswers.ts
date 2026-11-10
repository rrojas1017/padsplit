// CR-018: per-call survey answers for the Reports › Research call panel.
// Fetched only when the panel is open. Never exposes answer source.
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { resolveResearchCampaignType } from '@/utils/researchCampaignType';
import { getMatrixBlock, type MatrixLikeQuestion } from '@/utils/scriptMatrix';

export interface AnswerItem { key: string; label: string; answer: string | null }
export interface AnswerGroup { key: string; title: string | null; items: AnswerItem[] }

export interface ResearchCallAnswersState {
  isLoading: boolean;
  groups: AnswerGroup[];
  hasAnswers: boolean;
}

type ScriptQ = MatrixLikeQuestion & { is_internal?: boolean };

function answerText(a: any): string | null {
  if (!a || typeof a !== 'object') return null;
  if (Array.isArray(a.selected_option_labels) && a.selected_option_labels.length > 0) {
    return a.selected_option_labels.filter((s: unknown) => typeof s === 'string' && s).join(', ') || null;
  }
  if (typeof a.scale_value === 'number' && Number.isFinite(a.scale_value)) return String(a.scale_value);
  if (typeof a.raw_text_answer === 'string' && a.raw_text_answer.trim()) return a.raw_text_answer.trim();
  return null;
}

function toAnswerList(raw: unknown): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((x) => x && typeof x === 'object');
  if (typeof raw === 'object') return Object.values(raw as Record<string, unknown>).filter((x) => x && typeof x === 'object');
  return [];
}

async function resolveScriptQuestions(researchCallId: string | undefined, campaignType: string | null): Promise<ScriptQ[] | null> {
  // (a) research call → campaign → script (only where already readable)
  if (researchCallId) {
    const { data: rc } = await supabase.from('research_calls').select('campaign_id').eq('id', researchCallId).maybeSingle();
    if (rc?.campaign_id) {
      const { data: camp } = await supabase.from('research_campaigns').select('script_id').eq('id', rc.campaign_id).maybeSingle();
      if (camp?.script_id) {
        const { data: s } = await supabase.from('research_scripts').select('questions').eq('id', camp.script_id).maybeSingle();
        if (s && Array.isArray(s.questions)) return s.questions as unknown as ScriptQ[];
      }
    }
  }
  // (b) single active script matching the campaign type
  if (campaignType) {
    const { data: scripts } = await supabase.from('research_scripts').select('id, slug, questions').eq('is_active', true);
    const matches = (scripts || []).filter((s) => resolveResearchCampaignType({ id: s.id, slug: s.slug }) === campaignType);
    if (matches.length === 1 && Array.isArray(matches[0].questions)) return matches[0].questions as unknown as ScriptQ[];
  }
  return null;
}

export function buildAnswerGroups(questions: ScriptQ[] | null, raw: unknown): AnswerGroup[] {
  const list = toAnswerList(raw);
  if (!questions) {
    return list.length === 0 ? [] : [{
      key: 'stored', title: null,
      items: list.map((a, i) => ({ key: String(a.question_id ?? i), label: String(a.question_text ?? `Question ${i + 1}`), answer: answerText(a) })),
    }];
  }
  const byId = new Map<string, any>();
  list.forEach((a) => { if (a.question_id != null) byId.set(String(a.question_id), a); });
  const idOf = (q: ScriptQ, i: number) => (q.id != null && String(q.id).trim() !== '' ? String(q.id) : `q_idx_${i}`);
  const groups: AnswerGroup[] = [];
  let i = 0;
  while (i < questions.length) {
    const block = getMatrixBlock(questions, i);
    if (block) {
      const items: AnswerItem[] = [];
      for (let j = block.start; j <= block.end; j++) {
        const q = questions[j];
        if (q.is_internal) continue;
        const id = idOf(q, j);
        items.push({ key: id, label: q.matrix?.row || q.question || q.text || '', answer: answerText(byId.get(id)) });
      }
      if (items.length) groups.push({ key: `g_${i}`, title: questions[block.start].matrix?.title || null, items });
      i = block.end + 1;
      continue;
    }
    const q = questions[i];
    if (!q.is_internal) {
      const id = idOf(q, i);
      groups.push({ key: id, title: null, items: [{ key: id, label: q.question || q.text || '', answer: answerText(byId.get(id)) }] });
    }
    i++;
  }
  return groups;
}

export function useResearchCallAnswers(
  bookingId: string | null,
  researchCallId?: string,
): ResearchCallAnswersState {
  const [state, setState] = useState<ResearchCallAnswersState>({ isLoading: false, groups: [], hasAnswers: false });

  useEffect(() => {
    if (!bookingId) { setState({ isLoading: false, groups: [], hasAnswers: false }); return; }
    let cancelled = false;
    setState({ isLoading: true, groups: [], hasAnswers: false });
    (async () => {
      try {
        const { data: bt, error } = await supabase
          .from('booking_transcriptions')
          .select('research_extraction, research_campaign_type')
          .eq('booking_id', bookingId)
          .maybeSingle();
        if (error) console.warn('[call-panel] answers unavailable', error.code);
        const raw = (bt?.research_extraction as any)?.raw_script_answers;
        const hasAnswers = toAnswerList(raw).some((a) => answerText(a) !== null);
        const questions = hasAnswers ? await resolveScriptQuestions(researchCallId, bt?.research_campaign_type ?? null) : null;
        if (cancelled) return;
        setState({ isLoading: false, groups: hasAnswers ? buildAnswerGroups(questions, raw) : [], hasAnswers });
      } catch {
        if (!cancelled) setState({ isLoading: false, groups: [], hasAnswers: false });
      }
    })();
    return () => { cancelled = true; };
  }, [bookingId, researchCallId]);

  return state;
}
