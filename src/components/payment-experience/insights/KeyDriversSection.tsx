import { TrendingUp } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { InsightCard } from './primitives/InsightCard';
import { ConfidenceChip } from './primitives/ConfidenceChip';
import { WhyThisMatters } from './primitives/WhyThisMatters';
import type { DriverInsight } from '@/utils/paymentExperienceAnalytics';

interface KeyDriversSectionProps {
  drivers: DriverInsight[];
}

export function KeyDriversSection({ drivers }: KeyDriversSectionProps) {
  if (!drivers.length) return null;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {drivers.map((d) => (
        <InsightCard
          key={d.id}
          icon={
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <span className="inline-flex cursor-help p-0.5">
                  <TrendingUp className="w-4 h-4 text-muted-foreground" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[11px] max-w-[240px]">
                Compares two groups within eligible respondents to surface meaningful lifts.
              </TooltipContent>
            </Tooltip>
          }
          title={d.headline}
          rightSlot={<ConfidenceChip level={d.confidence} />}
        >
          <WhyThisMatters>{d.detail}</WhyThisMatters>
          <p className="mt-1.5 text-[10px] text-muted-foreground/70 tabular-nums">N={d.n}</p>
        </InsightCard>
      ))}
    </div>
  );
}
