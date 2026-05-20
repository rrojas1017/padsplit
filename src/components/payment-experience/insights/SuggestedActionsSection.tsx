import { Lightbulb } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { InsightCard } from './primitives/InsightCard';
import { WhyThisMatters } from './primitives/WhyThisMatters';
import type { SuggestedAction } from '@/utils/paymentExperienceAnalytics';

interface SuggestedActionsSectionProps {
  actions: SuggestedAction[];
}

function priorityForIndex(i: number): { label: string; footer: string } {
  if (i === 0) return { label: 'High impact', footer: 'High reach' };
  if (i === 1) return { label: 'Medium impact', footer: 'Broad operational impact' };
  return { label: 'Quick win', footer: 'Targeted improvement' };
}

export function SuggestedActionsSection({ actions }: SuggestedActionsSectionProps) {
  if (!actions.length) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {actions.map((a, i) => {
        const priority = priorityForIndex(i);
        return (
          <InsightCard
            key={a.id}
            icon={<Lightbulb className="w-4 h-4 text-muted-foreground" />}
            title={a.title}
            rightSlot={
              <Badge
                variant="outline"
                className="h-5 px-1.5 text-[10px] font-normal tracking-wide text-muted-foreground border-muted-foreground/20 bg-transparent shrink-0"
              >
                {priority.label}
              </Badge>
            }
          >
            <p className="text-xs text-muted-foreground leading-relaxed">{a.detail}</p>
            <div className="mt-2">
              <WhyThisMatters>{a.basedOn}</WhyThisMatters>
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground/70">{priority.footer}</p>
          </InsightCard>
        );
      })}
    </div>
  );
}
