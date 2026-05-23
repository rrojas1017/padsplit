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

export function PaymentScheduleTab({ eligibleRecords, totalRouted }: Props) {
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

  const q1 = data.questions.find((q) => q.question.order === 1);
  const q2 = data.questions.find((q) => q.question.order === 2);

  return (
    <div className="space-y-3">
      {q1 && (
        <TopicQuestionCard
          summary={q1}
          title={PE_TOPIC_TITLES[1]}
          chart="ranked-bars"
          maxRows={8}
        />
      )}
      {q2 && (
        <TopicQuestionCard
          summary={q2}
          title={PE_TOPIC_TITLES[2]}
          chart="bars"
          fixedOrder={PE_WEEKDAY_ORDER}
        />
      )}
    </div>
  );
}
