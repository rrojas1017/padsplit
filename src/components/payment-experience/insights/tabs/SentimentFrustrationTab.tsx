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

export function SentimentFrustrationTab({ eligibleRecords, totalRouted }: Props) {
  const data = useMemo(
    () => derivePaymentExperienceScriptData(eligibleRecords, totalRouted),
    [eligibleRecords, totalRouted],
  );

  const qs = data.questions.find((q) => q.question.order === 11);

  if (data.stats.respondents === 0 || !qs) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          No eligible Payment Experience responses to display.
        </CardContent>
      </Card>
    );
  }

  return (
    <TopicQuestionCard
      summary={qs}
      title={PE_TOPIC_TITLES[11]}
      chart="ranked-bars"
      maxRows={8}
    />
  );
}
