import { useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, ClipboardList } from 'lucide-react';
import { QuestionResponseCard } from './QuestionResponseCard';
import { formatAggLabels, capSlices } from '@/utils/audienceSurveyInsights';
import { generateAudienceSurveyReport } from './generateAudienceSurveyReport';
import type { AudienceSurveyRecord, AggResult } from '@/hooks/useAudienceSurveyResponses';

interface ScriptResponsesTabProps {
  records: AudienceSurveyRecord[];
  aggregateArray: (records: AudienceSurveyRecord[], accessor: (r: AudienceSurveyRecord) => string[] | undefined) => AggResult[];
  aggregateBoolean: (records: AudienceSurveyRecord[], accessor: (r: AudienceSurveyRecord) => boolean | undefined | null) => { yes: number; no: number; total: number; pct: number };
}

interface QuestionDef {
  key: string;
  label: string;
  type: 'multi' | 'yesno';
  accessor: (r: AudienceSurveyRecord) => string[] | undefined;
  boolAccessor?: (r: AudienceSurveyRecord) => boolean | undefined | null;
}

const QUESTIONS: QuestionDef[] = [
  { key: 'q1', label: 'Which social media platforms do you use?', type: 'multi', accessor: r => r.extraction.social_media_platforms?.platforms_used },
  { key: 'q2', label: 'Do you follow any influencers?', type: 'yesno', accessor: () => undefined, boolAccessor: r => r.extraction.influencer_following?.follows_influencers },
  { key: 'q3', label: 'Have you noticed any standout housing ads?', type: 'yesno', accessor: () => undefined, boolAccessor: r => r.extraction.ad_awareness?.noticed_standout_ads },
  { key: 'q4', label: 'Have you seen PadSplit ads?', type: 'yesno', accessor: () => undefined, boolAccessor: r => r.extraction.ad_awareness?.has_seen_padsplit_ads },
  { key: 'q5', label: 'Where would you expect to see PadSplit ads?', type: 'multi', accessor: r => r.extraction.ad_awareness?.expected_padsplit_ad_platforms },
  { key: 'q6', label: 'What makes you stop scrolling on an ad?', type: 'multi', accessor: r => r.extraction.ad_engagement?.what_makes_them_stop_scrolling },
  { key: 'q7', label: 'What would make you click on an ad?', type: 'multi', accessor: r => r.extraction.ad_engagement?.what_makes_them_click_ad },
  { key: 'q8', label: 'What were your initial concerns about PadSplit?', type: 'multi', accessor: r => r.extraction.first_impressions?.initial_concerns },
  { key: 'q9', label: 'What initially interested you about PadSplit?', type: 'multi', accessor: r => r.extraction.first_impressions?.interest_drivers },
  { key: 'q10', label: 'What was confusing about PadSplit?', type: 'multi', accessor: r => r.extraction.first_impressions?.confusing_aspects },
  { key: 'q11', label: 'Do you prefer detailed or short ads?', type: 'multi', accessor: r => r.extraction.ad_engagement?.ad_detail_preferences },
  { key: 'q12', label: 'What content would you want to see?', type: 'multi', accessor: r => r.extraction.ad_engagement?.preferred_content_types },
  { key: 'q13', label: 'Would you record a video testimonial?', type: 'yesno', accessor: () => undefined, boolAccessor: r => r.extraction.video_testimonial?.interested_in_recording },
];

export function ScriptResponsesTab({ records, aggregateArray, aggregateBoolean }: ScriptResponsesTabProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToQuestion = (qKey: string) => {
    const el = document.getElementById(`question-${qKey}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Compute avg questions answered
  const countAnswered = (r: AudienceSurveyRecord): number => {
    const ext = r.extraction;
    let count = 0;
    const hasArr = (a: any[] | undefined) => Array.isArray(a) && a.length > 0;
    const hasBool = (b: boolean | undefined | null) => typeof b === 'boolean';
    if (hasArr(ext.social_media_platforms?.platforms_used)) count++;
    if (hasBool(ext.influencer_following?.follows_influencers)) count++;
    if (hasBool(ext.ad_awareness?.noticed_standout_ads)) count++;
    if (hasBool(ext.ad_awareness?.has_seen_padsplit_ads)) count++;
    if (hasArr(ext.ad_awareness?.expected_padsplit_ad_platforms) || hasArr(ext.ad_awareness?.where_seen_padsplit_ads)) count++;
    if (hasArr(ext.ad_engagement?.what_makes_them_stop_scrolling)) count++;
    if (hasArr(ext.ad_engagement?.what_makes_them_click_ad)) count++;
    if (hasArr(ext.first_impressions?.initial_concerns)) count++;
    if (hasArr(ext.first_impressions?.interest_drivers)) count++;
    if (hasArr(ext.first_impressions?.confusing_aspects)) count++;
    if (hasArr(ext.ad_engagement?.ad_detail_preferences)) count++;
    if (hasArr(ext.ad_engagement?.preferred_content_types)) count++;
    if (hasBool(ext.video_testimonial?.interested_in_recording)) count++;
    return count;
  };

  const totalAnswered = records.reduce((sum, r) => sum + countAnswered(r), 0);
  const avgAnswered = records.length > 0 ? Math.round((totalAnswered / records.length) * 10) / 10 : 0;
  const completionRate = records.length > 0 ? Math.round((avgAnswered / 13) * 100) : 0;

  const lastDate = records.length > 0
    ? records.reduce((latest, r) => r.booking_date > latest ? r.booking_date : latest, records[0].booking_date)
    : null;

  // Pre-aggregate all questions
  const questionData = QUESTIONS.map(q => {
    if (q.type === 'multi') {
      const raw = aggregateArray(records, q.accessor);
      const formatted = formatAggLabels(raw);
      return { ...q, data: capSlices(formatted, 8), boolData: undefined };
    }
    const boolData = aggregateBoolean(records, q.boolAccessor!);
    return { ...q, data: [] as AggResult[], boolData };
  });

  const handleDownload = () => {
    generateAudienceSurveyReport(records, questionData.map(q => ({
      number: QUESTIONS.findIndex(qq => qq.key === q.key) + 1,
      label: q.label,
      type: q.type,
      data: q.data,
      boolData: q.boolData,
    })), {
      totalRecords: records.length,
      avgAnswered,
      completionRate,
    });
  };

  return (
    <div ref={containerRef} className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            Script Responses
          </h3>
          <p className="text-sm text-muted-foreground">
            Audience Survey · {records.length} responses · 13 questions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select onValueChange={scrollToQuestion}>
            <SelectTrigger className="w-[180px] h-9 text-xs">
              <SelectValue placeholder="Jump to question…" />
            </SelectTrigger>
            <SelectContent>
              {QUESTIONS.map((q, i) => (
                <SelectItem key={q.key} value={q.key} className="text-xs">
                  Q{i + 1}: {q.label.slice(0, 40)}{q.label.length > 40 ? '…' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={handleDownload} className="gap-1.5">
            <Download className="w-3.5 h-3.5" />
            Download Report
          </Button>
        </div>
      </div>

      {/* Progress summary */}
      <Card className="shadow-sm bg-muted/50">
        <CardContent className="p-4 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <span>
            <strong className="text-foreground">Completion Rate:</strong>{' '}
            <span className="text-muted-foreground">{completionRate}%</span>
          </span>
          <span>
            <strong className="text-foreground">Avg Questions Answered:</strong>{' '}
            <span className="text-muted-foreground">{avgAnswered} / 13</span>
          </span>
          <span>
            <strong className="text-foreground">Respondents:</strong>{' '}
            <span className="text-muted-foreground">{records.length}</span>
          </span>
          {lastDate && (
            <span>
              <strong className="text-foreground">Latest Response:</strong>{' '}
              <span className="text-muted-foreground">{new Date(lastDate).toLocaleDateString()}</span>
            </span>
          )}
        </CardContent>
      </Card>

      {/* Question cards */}
      {questionData.map((q, i) => (
        <QuestionResponseCard
          key={q.key}
          id={`question-${q.key}`}
          questionNumber={i + 1}
          label={q.label}
          type={q.type}
          data={q.data}
          boolData={q.boolData}
          totalRecords={records.length}
        />
      ))}
    </div>
  );
}
