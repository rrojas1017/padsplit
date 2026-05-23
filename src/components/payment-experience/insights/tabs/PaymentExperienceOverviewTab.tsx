import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import type { PaymentExperienceRecord } from '@/hooks/usePaymentExperienceResponses';
import {
  derivePaymentExperienceScriptData,
  PE_TOPIC_TITLES,
  PE_WEEKDAY_ORDER,
} from '@/utils/paymentExperienceScriptResponses';
import { TopicQuestionCard } from '../TopicQuestionCard';

interface Props {
  eligibleRecords: PaymentExperienceRecord[];
  totalRouted: number;
}

export function PaymentExperienceOverviewTab({ eligibleRecords, totalRouted }: Props) {
  const data = useMemo(
    () => derivePaymentExperienceScriptData(eligibleRecords, totalRouted),
    [eligibleRecords, totalRouted],
  );

  if (data.stats.respondents === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          No eligible Payment Experience responses to display.
        </CardContent>
      </Card>
    );
  }

  const q2 = data.questions.find((q) => q.question.order === 2);
  const q8 = data.questions.find((q) => q.question.order === 8);
  const q7 = data.questions.find((q) => q.question.order === 7);
  const q15 = data.questions.find((q) => q.question.order === 15);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {q2 && (
        <TopicQuestionCard
          summary={q2}
          title={PE_TOPIC_TITLES[2]}
          chart="bars"
          fixedOrder={PE_WEEKDAY_ORDER}
        />
      )}
      {q8 && (
        <TopicQuestionCard
          summary={q8}
          title={PE_TOPIC_TITLES[8]}
          chart="split-pill"
        />
      )}
      {q7 && (
        <TopicQuestionCard
          summary={q7}
          title={PE_TOPIC_TITLES[7]}
          chart="donut"
          maxRows={7}
        />
      )}
      {q15 && (
        <TopicQuestionCard
          summary={q15}
          title={PE_TOPIC_TITLES[15]}
          chart="ranked-bars"
          maxRows={6}
        />
      )}
    </div>
  );
}
