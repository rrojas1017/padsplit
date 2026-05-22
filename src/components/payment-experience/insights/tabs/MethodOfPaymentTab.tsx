import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import type { PaymentExperienceRecord } from '@/hooks/usePaymentExperienceResponses';
import { derivePaymentExperienceScriptData } from '@/utils/paymentExperienceScriptResponses';
import { ScriptQuestionGraphCard } from '../ScriptQuestionGraphCard';

interface Props {
  eligibleRecords: PaymentExperienceRecord[];
  totalRouted: number;
}

export function MethodOfPaymentTab({ eligibleRecords, totalRouted }: Props) {
  const data = useMemo(
    () => derivePaymentExperienceScriptData(eligibleRecords, totalRouted),
    [eligibleRecords, totalRouted],
  );

  const qs = data.questions.find((q) => q.question.order === 7);

  if (data.stats.respondents === 0 || !qs) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          No eligible Payment Experience responses to display.
        </CardContent>
      </Card>
    );
  }

  return <ScriptQuestionGraphCard summary={qs} total={data.stats.respondents} />;
}
