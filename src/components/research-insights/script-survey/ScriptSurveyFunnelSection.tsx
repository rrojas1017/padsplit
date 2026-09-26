// Generic twin of PE SurveyFunnelSection (CR-010 Phase 2). Same markup; the
// footer shows a free-text detail line instead of PE eligibility fields.
import { ChevronRight, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Fragment } from 'react';
import type { FunnelStep } from '@/utils/paymentExperienceAnalytics';

interface ScriptSurveyFunnelSectionProps {
  steps: FunnelStep[];
  detail?: string;
}

export function ScriptSurveyFunnelSection({ steps, detail }: ScriptSurveyFunnelSectionProps) {
  if (steps.length < 2) return null;
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row md:items-stretch md:gap-2">
          {steps.map((step, idx) => (
            <Fragment key={step.id}>
              <div className="flex-1 min-w-0 py-1.5 md:py-0.5 md:px-2">
                <p className="text-2xl font-semibold tabular-nums text-foreground leading-none">
                  {step.count.toLocaleString()}
                </p>
                <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/90">
                  {step.label}
                </p>
              </div>
              {idx < steps.length - 1 && (
                <div className="hidden md:flex items-center text-muted-foreground/60">
                  <ChevronRight className="w-4 h-4" />
                </div>
              )}
              {idx < steps.length - 1 && (
                <div className="md:hidden border-b border-border" />
              )}
            </Fragment>
          ))}
        </div>
        {detail && (
          <div className="mt-3 pt-2 border-t border-border/60 text-[11px] text-muted-foreground/80 flex flex-wrap items-center gap-x-3 gap-y-1">
            <ShieldCheck className="w-3 h-3 text-emerald-500/70 shrink-0" />
            <span>{detail}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
