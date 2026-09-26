// CR-010 Phase 2: adapts per-script survey summaries into PE's summary shape
// so PE visuals (TopicQuestionCard, report layout) can be reused unchanged.
import type {
  PEDistributionItem,
  PEQuestionSummary,
  PEQuestionType,
  PEScriptData,
} from '@/utils/paymentExperienceScriptResponses';
import type { ScriptSurveyQuestion, ScriptSurveyRecord } from '@/hooks/useScriptSurveyResponses';
import {
  deriveScriptSurveyStats,
  summarizeScriptQuestion,
  type ScriptQuestionSummary,
} from '@/utils/scriptSurveyAnalytics';

const TYPE_MAP: Record<ScriptSurveyQuestion['type'], PEQuestionType> = {
  multiple_choice: 'multi',
  yes_no: 'yesno',
  scale: 'scale',
  open_ended: 'open',
};

const round1 = (p: number) => Math.round(p * 10) / 10;

function yesNoKey(label: string): string {
  const l = label.trim().toLowerCase();
  if (l.startsWith('yes')) return 'yes';
  if (l.startsWith('no')) return 'no';
  return l;
}

export function toPEQuestionSummary(q: ScriptSurveyQuestion, s: ScriptQuestionSummary): PEQuestionSummary {
  const type = TYPE_MAP[q.type] ?? 'multi';
  const base = {
    question: {
      order: q.order,
      id: q.id,
      text: q.question,
      section: q.section,
      type,
      scaleMin: q.scale_min,
      scaleMax: q.scale_max,
    },
    count: s.count,
  };
  if (s.type === 'scale') {
    const distribution: PEDistributionItem[] = s.buckets.map((b) => ({
      key: b.label, label: b.label, count: b.count, percentage: round1(b.pct),
    }));
    return {
      ...base,
      distribution,
      avg: s.avg ?? undefined,
      min: s.min ?? undefined,
      max: s.max ?? undefined,
    };
  }
  if (s.type === 'open_ended') {
    return {
      ...base,
      distribution: [],
      samples: s.samples,
      totalSamples: s.allResponses.length,
      allResponses: s.allResponses,
    };
  }
  const distribution: PEDistributionItem[] = s.distribution.map((d) => ({
    key: s.type === 'yes_no' ? yesNoKey(d.label) : d.label,
    label: d.label,
    count: d.count,
    percentage: round1(d.pct),
  }));
  const top = distribution[0];
  return {
    ...base,
    distribution,
    uniqueAnswers: distribution.length,
    topLabel: top?.label,
    topCount: top?.count,
    topPct: top?.percentage,
  };
}

export function toPEScriptData(questions: ScriptSurveyQuestion[], eligible: ScriptSurveyRecord[]): PEScriptData {
  const stats = deriveScriptSurveyStats(questions, eligible);
  return {
    questions: questions.map((q) => toPEQuestionSummary(q, summarizeScriptQuestion(q, eligible))),
    stats: {
      responseCount: eligible.reduce((a, r) => a + r.answeredCount, 0),
      questionCount: questions.length,
      completionRate: stats.completionRate,
      avgQuestionsAnswered: stats.avgQuestionsAnswered,
      respondents: stats.respondents,
      latestResponseAt: stats.latestResponseAt,
    },
  };
}
