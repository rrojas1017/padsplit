import { IssueClustersPanel } from '@/components/research-insights/IssueClustersPanel';
import { TopActionsTable } from '@/components/research-insights/TopActionsTable';
import { BlindSpotsPanel } from '@/components/research-insights/BlindSpotsPanel';
import type { ResearchInsightData } from '@/types/research-insights';

interface MoveOutIssuesTabProps {
  reportData: ResearchInsightData;
}

export function MoveOutIssuesTab({ reportData }: MoveOutIssuesTabProps) {
  const hasClusters = reportData.issue_clusters?.length > 0;
  const hasActions = Array.isArray(reportData.top_actions) ? reportData.top_actions.length > 0 : !!reportData.top_actions;
  const hasBlindSpots = reportData.operational_blind_spots?.length > 0;

  if (!hasClusters && !hasActions && !hasBlindSpots) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        No issues or root causes data available in this report.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {hasClusters && (
        <IssueClustersPanel data={reportData.issue_clusters as any} maxVisible={5} />
      )}
      {hasActions && (
        <TopActionsTable data={reportData.top_actions} />
      )}
      {hasBlindSpots && (
        <BlindSpotsPanel data={reportData.operational_blind_spots as any} maxVisible={5} />
      )}
    </div>
  );
}
