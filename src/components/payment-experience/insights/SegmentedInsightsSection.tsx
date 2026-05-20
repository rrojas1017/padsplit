import { Filter } from 'lucide-react';
import { InsightCard } from './primitives/InsightCard';
import { MetricComparisonRow } from './primitives/MetricComparisonRow';
import type { SegmentCard } from '@/utils/paymentExperienceAnalytics';

interface SegmentedInsightsSectionProps {
  segments: SegmentCard[];
}

export function SegmentedInsightsSection({ segments }: SegmentedInsightsSectionProps) {
  if (!segments.length) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {segments.map((seg) => (
        <InsightCard
          key={seg.id}
          icon={<Filter className="w-4 h-4 text-muted-foreground" />}
          title={seg.title}
          rightSlot={
            <span className="text-[11px] text-muted-foreground/70 shrink-0">{seg.metricLabel}</span>
          }
        >
          <div className="space-y-3">
            {seg.rows.map((row) => (
              <MetricComparisonRow key={row.label} row={row} />
            ))}
          </div>
        </InsightCard>
      ))}
    </div>
  );
}
