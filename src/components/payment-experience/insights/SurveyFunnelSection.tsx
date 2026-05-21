import { ChevronRight, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Fragment } from 'react';
import type { FunnelStep } from '@/utils/paymentExperienceAnalytics';

export interface FunnelEligibilityMeta {
  eligible: number;
  routedTotal: number;
  excluded: number;
  voicemail: number;
  tooShort: number;
  insufficientExtraction: number;
}

interface SurveyFunnelSectionProps {
  steps: FunnelStep[];
  eligibility?: FunnelEligibilityMeta;
}

export function SurveyFunnelSection({ steps, eligibility }: SurveyFunnelSectionProps) {
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
        {eligibility && (
          <div className="mt-3 pt-2 border-t border-border/60 text-[11px] text-muted-foreground/80 flex flex-wrap items-center gap-x-3 gap-y-1">
            <ShieldCheck className="w-3 h-3 text-emerald-500/70 shrink-0" />
            {eligibility.excluded === 0 ? (
              <span>All routed responses eligible</span>
            ) : (
              <>
                <span>
                  <span className="tabular-nums">{eligibility.eligible.toLocaleString()}</span>
                  /{eligibility.routedTotal.toLocaleString()} eligible
                </span>
                <span aria-hidden="true" className="text-muted-foreground/40">·</span>
                <span>
                  <span className="tabular-nums">{eligibility.excluded.toLocaleString()}</span> excluded
                </span>
                {eligibility.voicemail > 0 && (
                  <>
                    <span aria-hidden="true" className="text-muted-foreground/40">·</span>
                    <span>
                      <span className="tabular-nums">{eligibility.voicemail.toLocaleString()}</span> voicemail
                    </span>
                  </>
                )}
                {eligibility.tooShort > 0 && (
                  <>
                    <span aria-hidden="true" className="text-muted-foreground/40">·</span>
                    <span>
                      <span className="tabular-nums">{eligibility.tooShort.toLocaleString()}</span> too short
                    </span>
                  </>
                )}
                {eligibility.insufficientExtraction > 0 && (
                  <>
                    <span aria-hidden="true" className="text-muted-foreground/40">·</span>
                    <span>
                      <span className="tabular-nums">{eligibility.insufficientExtraction.toLocaleString()}</span> incomplete extraction
                    </span>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
