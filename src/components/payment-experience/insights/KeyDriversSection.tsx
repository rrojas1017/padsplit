import { TrendingUp } from 'lucide-react';
import { InsightCard } from './primitives/InsightCard';
import { ConfidenceChip } from './primitives/ConfidenceChip';
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
          icon={<TrendingUp className="w-4 h-4 text-muted-foreground" />}
          title={d.headline}
          rightSlot={<ConfidenceChip level={d.confidence} />}
        >
          <p className="text-xs text-muted-foreground leading-relaxed">{d.detail}</p>
          <p className="mt-2 text-[10px] text-muted-foreground/70 tabular-nums">N={d.n}</p>
        </InsightCard>
      ))}
    </div>
  );
}
