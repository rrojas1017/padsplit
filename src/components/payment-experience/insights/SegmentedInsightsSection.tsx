import { Filter } from 'lucide-react';
import { InsightCard } from './primitives/InsightCard';
import { MetricComparisonRow } from './primitives/MetricComparisonRow';
import { ConfidenceChip } from './primitives/ConfidenceChip';
import { CompactBarRow } from './visuals/CompactBarRow';
import { ComparisonProgressRows } from './visuals/ComparisonProgressRows';
import type { SegmentCard } from '@/utils/paymentExperienceAnalytics';

interface SegmentedInsightsSectionProps {
  segments: SegmentCard[];
}

function renderSegmentBody(seg: SegmentCard) {
  if (seg.id === 'autopay-by-cadence') {
    return (
      <div className="space-y-3">
        {seg.rows.map((row) => (
          <CompactBarRow
            key={row.label}
            label={row.label}
            valueLabel={row.display}
            percent={row.percent ?? null}
            n={row.n}
            tone="blue"
            rightSlot={<ConfidenceChip level={row.confidence} />}
          />
        ))}
      </div>
    );
  }

  if (seg.id === 'hardship-by-autopay') {
    return (
      <ComparisonProgressRows
        tone="green"
        rows={seg.rows.map((row) => ({
          label: row.label,
          percent: row.percent ?? null,
          valueLabel: row.display,
          n: row.n,
          confidence: row.confidence,
        }))}
      />
    );
  }

  return (
    <div className="space-y-3">
      {seg.rows.map((row) => (
        <MetricComparisonRow key={row.label} row={row} />
      ))}
    </div>
  );
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
          {renderSegmentBody(seg)}
        </InsightCard>
      ))}
    </div>
  );
}
