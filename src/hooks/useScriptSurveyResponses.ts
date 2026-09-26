import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllPages } from '@/utils/fetchAllPages';
import { ensureQuestionIds } from '@/utils/rawScriptAnswers';
import { resolveResearchCampaignType } from '@/utils/researchCampaignType';
import { hasAnswerValue, type RawAnswerEntry } from '@/utils/scriptSurveyAnalytics';
import type { ScriptQuestion } from '@/hooks/useResearchScripts';

export interface ScriptSurveyQuestion {
  id: string;
  order: number;
  question: string;
  type: ScriptQuestion['type'];
  options?: string[];
  scale_min?: number;
  scale_max?: number;
  section?: string;
  ai_extraction_hint?: string;
}

export interface ScriptSurveyScript {
  id: string;
  name: string;
  slug: string | null;
  campaignType: string;
}

export interface ScriptSurveyRecord {
  id: string;
  booking_id: string;
  booking_date: string;
  call_duration_seconds: number | null;
  has_valid_conversation: boolean | null;
  transcription_status: string | null;
  kixie_link: string | null;
  research_call_id: string | null;
  research_processing_status: string | null;
  survey_progress: unknown;
  answers: Record<string, RawAnswerEntry>;
  answeredCount: number;
  isForm: boolean;
  hasRecording: boolean;
}

export function useScriptSurveyResponses(scriptId: string | null | undefined) {
  const query = useQuery({
    queryKey: ['script-survey-responses', scriptId],
    enabled: !!scriptId,
    queryFn: async () => {
      const { data: s, error } = await supabase
        .from('research_scripts')
        .select('id, name, slug, questions')
        .eq('id', scriptId!)
        .maybeSingle();
      if (error) throw error;
      if (!s) return null;

      const campaignType = resolveResearchCampaignType({ id: s.id, slug: (s as any).slug ?? null }) as string;
      const all = ensureQuestionIds(((s as any).questions || []) as ScriptQuestion[]);
      const questions: ScriptSurveyQuestion[] = all
        .filter((q) => !q.is_internal)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((q) => ({
          id: String(q.id),
          order: q.order,
          question: q.question,
          type: q.type,
          options: q.options,
          scale_min: q.scale_min,
          scale_max: q.scale_max,
          section: q.section,
          ai_extraction_hint: q.ai_extraction_hint,
        }));

      const rows = await fetchAllPages((from, to) =>
        (supabase as any)
          .from('booking_transcriptions')
          .select(
            'id, booking_id, research_processing_status, survey_progress, ' +
            'raw_script_answers:research_extraction->raw_script_answers, ' +
            'bookings!inner(id, booking_date, call_duration_seconds, has_valid_conversation, transcription_status, kixie_link, research_call_id, record_type)',
          )
          .eq('research_campaign_type', campaignType)
          .eq('bookings.record_type', 'research')
          .order('id', { ascending: true })
          .range(from, to),
      );

      const records: ScriptSurveyRecord[] = rows.map((row: any) => {
        const b = row.bookings || {};
        const raw = (row.raw_script_answers && typeof row.raw_script_answers === 'object'
          ? row.raw_script_answers
          : {}) as Record<string, RawAnswerEntry>;
        const answers: Record<string, RawAnswerEntry> = {};
        let answeredCount = 0;
        for (const q of questions) {
          const e = raw[q.id];
          if (e) answers[q.id] = e;
          if (hasAnswerValue(e)) answeredCount++;
        }
        const isForm = Object.values(raw).some((e: any) => e?.source === 'agent_runtime');
        return {
          id: row.id,
          booking_id: row.booking_id ?? b.id,
          booking_date: b.booking_date || '',
          call_duration_seconds: b.call_duration_seconds ?? null,
          has_valid_conversation: b.has_valid_conversation ?? null,
          transcription_status: b.transcription_status ?? null,
          kixie_link: b.kixie_link ?? null,
          research_call_id: b.research_call_id ?? null,
          research_processing_status: row.research_processing_status ?? null,
          survey_progress: row.survey_progress ?? null,
          answers,
          answeredCount,
          isForm,
          hasRecording: !!b.kixie_link,
        };
      });

      const script: ScriptSurveyScript = { id: s.id, name: (s as any).name, slug: (s as any).slug ?? null, campaignType };
      return { script, questions, records };
    },
  });

  const data = query.data;
  const questions = data?.questions || [];
  const records = data?.records || [];
  const sections: string[] = [];
  for (const q of questions) if (q.section && !sections.includes(q.section)) sections.push(q.section);
  const validRecords = records.filter((r) => r.has_valid_conversation === true);
  const eligibleRecords = validRecords.filter((r) => r.answeredCount > 0);

  return {
    script: data?.script ?? null,
    questions,
    sections,
    records,
    validRecords,
    eligibleRecords,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
