import { Lightbulb } from 'lucide-react';
import { InsightCard } from './primitives/InsightCard';
import type { SuggestedAction } from '@/utils/paymentExperienceAnalytics';

interface SuggestedActionsSectionProps {
  actions: SuggestedAction[];
}

export function SuggestedActionsSection({ actions }: SuggestedActionsSectionProps) {
  if (!actions.length) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {actions.map((a) => (
        <InsightCard
          key={a.id}
          icon={<Lightbulb className="w-4 h-4 text-muted-foreground" />}
          title={a.title}
        >
          <p className="text-xs text-muted-foreground leading-relaxed">{a.detail}</p>
          <p className="mt-2 text-[10px] text-muted-foreground/70 leading-snug">
            Based on: {a.basedOn}
          </p>
        </InsightCard>
      ))}
    </div>
  );
}
