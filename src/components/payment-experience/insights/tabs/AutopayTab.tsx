import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import type { PaymentExperienceRecord } from '@/hooks/usePaymentExperienceResponses';
import {
  derivePaymentExperienceScriptData,
  PE_TOPIC_TITLES,
} from '@/utils/paymentExperienceScriptResponses';
import { TopicQuestionCard } from '../TopicQuestionCard';

interface Props {
  eligibleRecords: PaymentExperienceRecord[];
  totalRouted: number;
}

export function AutopayTab({ eligibleRecords, totalRouted }: Props) {
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

  const q8 = data.questions.find((q) => q.question.order === 8);
  const q9 = data.questions.find((q) => q.question.order === 9);

  return (
    <div className="space-y-3">
      {q8 && (
        <TopicQuestionCard
          summary={q8}
          title={PE_TOPIC_TITLES[8]}
          chart="split-pill"
        />
      )}
      {q9 && (
        <TopicQuestionCard
          summary={q9}
          title={PE_TOPIC_TITLES[9]}
          chart="ranked-bars"
          maxRows={8}
        />
      )}
    </div>
  );
}
