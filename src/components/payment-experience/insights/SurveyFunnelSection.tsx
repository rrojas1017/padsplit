import { ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Fragment } from 'react';
import type { FunnelStep } from '@/utils/paymentExperienceAnalytics';

interface SurveyFunnelSectionProps {
  steps: FunnelStep[];
}

export function SurveyFunnelSection({ steps }: SurveyFunnelSectionProps) {
  if (steps.length < 2) return null;
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row md:items-stretch md:gap-2">
          {steps.map((step, idx) => (
            <Fragment key={step.id}>
              <div className="flex-1 min-w-0 py-2 md:py-1 md:px-2">
                <p className="text-2xl font-semibold tabular-nums text-foreground leading-none">
                  {step.count.toLocaleString()}
                </p>
                <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                  {step.label}
                </p>
              </div>
              {idx < steps.length - 1 && (
                <div className="hidden md:flex items-center text-muted-foreground/40">
                  <ChevronRight className="w-4 h-4" />
                </div>
              )}
              {idx < steps.length - 1 && (
                <div className="md:hidden border-b border-border/60" />
              )}
            </Fragment>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
