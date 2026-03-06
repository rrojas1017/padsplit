import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target } from 'lucide-react';
import { PriorityBadge } from './PriorityBadge';

interface ActionItem {
  action: string;
  description?: string;
  rationale?: string;
  ownership?: string;
  owner?: string;
  priority?: string;
  effort?: string;
  rank?: number;
  cases_affected?: number;
  pct_of_batch?: number;
  quick_win?: string | null;
}

interface TopActionsPanelProps {
  // Can be an object with grouped arrays or a flat array
  data: {
    p0_immediate_risk_mitigation?: ActionItem[];
    p1_systemic_process_redesign?: ActionItem[];
    quick_wins?: ActionItem[];
  } | ActionItem[];
}

function ActionCard({ item, index }: { item: ActionItem; index: number }) {
  const desc = item.description || item.rationale;
  const owner = item.ownership || item.owner;

  return (
    <div className="border border-border rounded-lg p-4 space-y-2">
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center">
          {item.rank ?? index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{item.action}</p>
          {desc && <p className="text-xs text-muted-foreground mt-1">{desc}</p>}
        </div>
      </div>
      {(owner || item.priority || item.effort || item.cases_affected != null) && (
        <div className="flex gap-2 flex-wrap ml-10">
          {item.priority && <PriorityBadge priority={item.priority} />}
          {owner && <Badge variant="outline">{owner}</Badge>}
          {item.effort && <Badge variant="outline" className="capitalize">{item.effort} effort</Badge>}
          {item.cases_affected != null && (
            <Badge variant="secondary">{item.cases_affected} cases{item.pct_of_batch ? ` (${item.pct_of_batch.toFixed(0)}%)` : ''}</Badge>
          )}
        </div>
      )}
      {item.quick_win && (
        <p className="text-xs text-foreground ml-10"><span className="font-medium">Quick win:</span> {item.quick_win}</p>
      )}
    </div>
  );
}

function ActionSection({ title, badge, items }: { title: string; badge: React.ReactNode; items: ActionItem[] }) {
  if (!items?.length) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {badge}
        <p className="text-sm font-semibold text-foreground">{title}</p>
      </div>
      {items.map((item, i) => (
        <ActionCard key={i} item={item} index={i} />
      ))}
    </div>
  );
}

export function TopActionsPanel({ data }: TopActionsPanelProps) {
  if (!data) return null;

  // Handle flat array (legacy)
  if (Array.isArray(data)) {
    if (!data.length) return null;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            Top Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.map((item, i) => (
            <ActionCard key={i} item={item} index={i} />
          ))}
        </CardContent>
      </Card>
    );
  }

  // Grouped object format
  const hasP0 = !!data.p0_immediate_risk_mitigation?.length;
  const hasP1 = !!data.p1_systemic_process_redesign?.length;
  const hasQW = !!data.quick_wins?.length;

  if (!hasP0 && !hasP1 && !hasQW) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          Top Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <ActionSection
          title="Immediate Risk Mitigation"
          badge={<PriorityBadge priority="P0" />}
          items={data.p0_immediate_risk_mitigation || []}
        />
        <ActionSection
          title="Systemic Process Redesign"
          badge={<PriorityBadge priority="P1" />}
          items={data.p1_systemic_process_redesign || []}
        />
        <ActionSection
          title="Quick Wins"
          badge={<Badge variant="secondary">Quick Win</Badge>}
          items={data.quick_wins || []}
        />
      </CardContent>
    </Card>
  );
}
