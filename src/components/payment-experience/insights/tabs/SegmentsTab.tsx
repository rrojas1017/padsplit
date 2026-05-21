import { SectionHeader } from '../primitives/SectionHeader';
import { SegmentedInsightsSection } from '../SegmentedInsightsSection';
import type { SegmentCard } from '@/utils/paymentExperienceAnalytics';

interface SegmentsTabProps {
  segments: SegmentCard[];
}

export function SegmentsTab({ segments }: SegmentsTabProps) {
  return (
    <div className="space-y-3">
      <SectionHeader title="Segmented Insights" />
      {segments.length > 0 ? (
        <SegmentedInsightsSection segments={segments} />
      ) : (
        <p className="text-xs text-muted-foreground py-2">No segment breakdowns available yet.</p>
      )}
    </div>
  );
}
