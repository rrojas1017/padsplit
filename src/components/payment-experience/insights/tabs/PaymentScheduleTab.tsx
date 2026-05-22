import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import type { PaymentExperienceRecord } from '@/hooks/usePaymentExperienceResponses';
import { derivePaymentExperienceScriptData } from '@/utils/paymentExperienceScriptResponses';
import { ScriptQuestionGraphCard } from '../ScriptQuestionGraphCard';

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

  const cards = [1, 2]
    .map((order) => data.questions.find((q) => q.question.order === order))
    .filter((q): q is NonNullable<typeof q> => Boolean(q));

  return (
    <div className="space-y-3">
      {cards.map((qs) => (
        <ScriptQuestionGraphCard
          key={qs.question.order}
          summary={qs}
          total={data.stats.respondents}
        />
      ))}
    </div>
  );
}
