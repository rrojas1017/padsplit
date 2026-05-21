import { SectionHeader } from '../primitives/SectionHeader';
import { EmergingRisksSection } from '../EmergingRisksSection';
import { SuggestedActionsSection } from '../SuggestedActionsSection';
import type {
  DriverInsight,
  EmergingRisk,
  SegmentCard,
  SuggestedAction,
} from '@/utils/paymentExperienceAnalytics';
import type { AutopayBarrierAgg } from '@/hooks/usePaymentExperienceResponses';

interface OverviewTabProps {
  emergingRisks: EmergingRisk[];
  suggestedActions: SuggestedAction[];
  autopayBarriers: AutopayBarrierAgg[];
  segments: SegmentCard[];
  keyDrivers: DriverInsight[];
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground py-2">{children}</p>;
}

interface SnapshotCellProps {
  label: string;
  value: string | null;
  helper?: string | null;
}

function SnapshotCell({ label, value, helper }: SnapshotCellProps) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2">
      <p className="text-[10px] tracking-wide text-muted-foreground/80 uppercase">{label}</p>
      <p className="text-sm font-medium text-foreground line-clamp-2 mt-0.5">
        {value ?? 'Not enough data.'}
      </p>
      {value && helper && (
        <p className="text-[11px] text-muted-foreground/70 tabular-nums mt-0.5">{helper}</p>
      )}
    </div>
  );
}

function InsightSnapshot({
  autopayBarriers,
  segments,
  keyDrivers,
}: {
  autopayBarriers: AutopayBarrierAgg[];
  segments: SegmentCard[];
  keyDrivers: DriverInsight[];
}) {
  // Top Barrier
  const topBarrier = autopayBarriers[0];
  const barrierValue = topBarrier?.label ?? null;
  const barrierHelper = topBarrier
    ? `${topBarrier.count} · ${Math.round((topBarrier.share || 0) * 100)}%`
    : null;

  // Top At-Risk Segment (lowest auto-pay enrollment by cadence)
  const cadenceSegment = segments.find((s) => s.id === 'autopay-by-cadence');
  const atRiskRow = cadenceSegment?.rows
    .filter((r) => typeof r.percent === 'number')
    .reduce<typeof cadenceSegment.rows[number] | null>(
      (lo, r) => (lo == null || (r.percent ?? Infinity) < (lo.percent ?? Infinity) ? r : lo),
      null,
    );
  const segmentValue = atRiskRow?.label ?? null;
  const segmentHelper = atRiskRow?.display ?? null;

  // Top Driver
  const topDriver = keyDrivers[0];
  const driverValue = topDriver?.headline ?? null;
  const driverHelper = topDriver ? `N=${topDriver.n}` : null;

  if (!barrierValue && !segmentValue && !driverValue) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <SnapshotCell label="Top Barrier" value={barrierValue} helper={barrierHelper} />
      <SnapshotCell label="Top At-Risk Segment" value={segmentValue} helper={segmentHelper} />
      <SnapshotCell label="Top Driver" value={driverValue} helper={driverHelper} />
    </div>
  );
}

export function OverviewTab({
  emergingRisks,
  suggestedActions,
  autopayBarriers,
  segments,
  keyDrivers,
}: OverviewTabProps) {
  const topAction = suggestedActions.slice(0, 1);
  return (
    <div className="space-y-3">
      <SectionHeader title="Member Insights" />
      <InsightSnapshot
        autopayBarriers={autopayBarriers}
        segments={segments}
        keyDrivers={keyDrivers}
      />

      <SectionHeader title="Top Emerging Risks" emphasis />
      {emergingRisks.length > 0 ? (
        <EmergingRisksSection risks={emergingRisks} />
      ) : (
        <EmptyHint>No emerging risks detected yet.</EmptyHint>
      )}

      <SectionHeader title="Top Priority Action" />
      {topAction.length > 0 ? (
        <SuggestedActionsSection actions={topAction} />
      ) : (
        <EmptyHint>No suggested actions yet.</EmptyHint>
      )}
    </div>
  );
}
