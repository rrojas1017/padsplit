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

function accentForIndex(i: number): string {
  if (i === 0) return 'border-amber-500/40 border-l-2 border-l-amber-500/70';
  if (i === 1) return 'border-l-2 border-l-muted-foreground/30';
  return '';
}

export function SuggestedActionsSection({ actions }: SuggestedActionsSectionProps) {
  if (!actions.length) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {actions.map((a, i) => {
        const priority = priorityForIndex(i);
        const accent = accentForIndex(i);
        const isTop = i === 0;
        return (
          <InsightCard
            key={a.id}
            className={accent}
            icon={<Lightbulb className="w-4 h-4 text-muted-foreground" />}
            title={a.title}
            rightSlot={
              <div className="flex items-center gap-1.5 shrink-0">
                {isTop && (
                  <Badge
                    variant="outline"
                    className="h-5 px-1.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400 border-amber-500/40 bg-amber-500/5"
                  >
                    Top Priority
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className="h-5 px-1.5 text-[10px] font-normal tracking-wide text-muted-foreground border-muted-foreground/20 bg-transparent"
                >
                  {priority.label}
                </Badge>
              </div>
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
