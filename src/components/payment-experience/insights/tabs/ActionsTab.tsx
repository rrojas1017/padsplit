import { SectionHeader } from '../primitives/SectionHeader';
import { SuggestedActionsSection } from '../SuggestedActionsSection';
import type { SuggestedAction } from '@/utils/paymentExperienceAnalytics';

interface ActionsTabProps {
  actions: SuggestedAction[];
}

export function ActionsTab({ actions }: ActionsTabProps) {
  return (
    <div className="space-y-3">
      <SectionHeader title="Suggested Actions" />
      {actions.length > 0 ? (
        <SuggestedActionsSection actions={actions} />
      ) : (
        <p className="text-xs text-muted-foreground py-2">No suggested actions yet.</p>
      )}
    </div>
  );
}
