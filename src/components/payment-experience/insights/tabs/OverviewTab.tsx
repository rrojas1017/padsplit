import { SectionHeader } from '../primitives/SectionHeader';
import { EmergingRisksSection } from '../EmergingRisksSection';
import { SuggestedActionsSection } from '../SuggestedActionsSection';
import type { EmergingRisk, SuggestedAction } from '@/utils/paymentExperienceAnalytics';

interface OverviewTabProps {
  emergingRisks: EmergingRisk[];
  suggestedActions: SuggestedAction[];
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground py-2">{children}</p>;
}

export function OverviewTab({ emergingRisks, suggestedActions }: OverviewTabProps) {
  const topAction = suggestedActions.slice(0, 1);
  return (
    <div className="space-y-3">
      <SectionHeader title="Member Insights" />

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
