import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target } from 'lucide-react';
import { PriorityBadge } from './PriorityBadge';

interface TopAction {
  rank?: number;
  action: string;
  rationale?: string;
  description?: string;
  cases_affected?: number;
  pct_of_batch?: number;
  priority?: string;
  owner?: string;
  effort?: string;
  quick_win?: string | null;
}

interface TopActionsPanelProps {
  data: TopAction[];
}

export function TopActionsPanel({ data }: TopActionsPanelProps) {
  if (!data?.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          Top Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.map((action, index) => {
          const rank = action.rank ?? index + 1;
          const rationale = action.rationale ?? action.description;

          return (
            <div key={rank} className="border border-border rounded-lg p-4 space-y-2">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center">
                  {rank}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{action.action}</p>
                  {rationale && <p className="text-xs text-muted-foreground mt-1">{rationale}</p>}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap ml-10">
                {action.priority && <PriorityBadge priority={action.priority} />}
                {action.owner && <Badge variant="outline">{action.owner}</Badge>}
                {action.effort && <Badge variant="outline" className="capitalize">{action.effort} effort</Badge>}
                {action.cases_affected != null && (
                  <Badge variant="secondary">{action.cases_affected} cases{action.pct_of_batch ? ` (${action.pct_of_batch.toFixed(0)}%)` : ''}</Badge>
                )}
              </div>
              {action.quick_win && (
                <div className="flex items-start gap-1.5 ml-10 mt-1">
                  <p className="text-xs text-foreground"><span className="font-medium">Quick win:</span> {action.quick_win}</p>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
