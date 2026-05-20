import { ConfidenceChip } from './ConfidenceChip';
import { InsightRow } from './InsightRow';
import type { SegmentRow } from '@/utils/paymentExperienceAnalytics';

interface MetricComparisonRowProps {
  row: SegmentRow;
}

export function MetricComparisonRow({ row }: MetricComparisonRowProps) {
  return (
    <InsightRow
      label={row.label}
      value={row.display}
      meta={
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground tabular-nums">N={row.n}</span>
          <ConfidenceChip level={row.confidence} />
        </div>
      }
    />
  );
}
