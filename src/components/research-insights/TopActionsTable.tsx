import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target } from 'lucide-react';
import { PriorityBadge } from './PriorityBadge';
import type { TopAction } from '@/types/research-insights';

interface TopActionsTableProps {
  data: TopAction[] | Record<string, TopAction[]>;
}

interface FlatAction extends TopAction {
  _group: string;
}

function normalizeAction(a: any): TopAction {
  return {
    action: a.action || a.recommendation || a.description || '',
    impact: a.impact || a.rationale || a.expected_impact || '',
    priority: a.priority || 'P1',
    owner: a.owner || a.ownership || undefined,
    effort: a.effort || undefined,
    rank: a.rank || undefined,
    cases: a.cases || undefined,
    timeline: a.timeline || undefined,
  };
}

function flattenActions(data: TopAction[] | Record<string, TopAction[]>): FlatAction[] {
  if (Array.isArray(data)) {
    return data.map((a) => ({ ...normalizeAction(a), _group: a.priority || 'Action' }) as FlatAction);
  }
  const rows: FlatAction[] = [];
  const grouped = data as Record<string, any[]>;
  (grouped.p0_immediate_risk_mitigation || []).forEach((a: any) =>
    rows.push({ ...normalizeAction(a), _group: 'P0', priority: a.priority || 'P0' } as FlatAction)
  );
  (grouped.p1_systemic_process_redesign || []).forEach((a: any) =>
    rows.push({ ...normalizeAction(a), _group: 'P1', priority: a.priority || 'P1' } as FlatAction)
  );
  (grouped.quick_wins || []).forEach((a: any) =>
    rows.push({ ...normalizeAction(a), _group: 'Quick Win', priority: a.priority || 'Quick Win' } as FlatAction)
  );
  return rows;
}

function groupBorderColor(group: string): string {
  const g = group.toUpperCase();
  if (g.includes('P0')) return 'border-l-destructive';
  if (g.includes('P1')) return 'border-l-amber-500';
  return 'border-l-emerald-500';
}

function effortBadge(effort?: string) {
  if (!effort) return null;
  const e = effort.toLowerCase();
  const variant = e === 'low' ? 'text-emerald-600 bg-emerald-500/10' : e === 'high' ? 'text-destructive bg-destructive/10' : 'text-amber-600 bg-amber-500/10';
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${variant}`}>{effort}</span>;
}

export function TopActionsTable({ data }: TopActionsTableProps) {
  const rows = flattenActions(data);
  if (!rows.length) return (
    <Card className="shadow-sm">
      <CardContent className="py-8 text-center text-sm text-muted-foreground">
        No actions in this report.
      </CardContent>
    </Card>
  );

  const hasOwner = rows.some((r) => r.owner || (r as any).ownership);

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
            <Target className="w-4 h-4 text-primary" />
          </div>
          Top Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 w-20">Priority</th>
                <th className="px-4 py-2">Action</th>
                {hasOwner && <th className="px-4 py-2 w-28">Owner</th>}
                <th className="px-4 py-2 w-24">Effort</th>
                <th className="px-4 py-2">Impact</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const desc = row.impact || (row as any).description || (row as any).rationale;
                const owner = row.owner || (row as any).ownership;
                return (
                  <tr
                    key={i}
                    className={`border-b border-border last:border-0 border-l-4 ${groupBorderColor(row._group)}`}
                  >
                    <td className="px-4 py-3">
                      <PriorityBadge priority={row.priority} />
                    </td>
                    <td className="px-4 py-3 text-foreground font-medium">{row.action}</td>
                    {hasOwner && (
                      <td className="px-4 py-3">
                        {owner && <Badge variant="outline" className="text-xs">{owner}</Badge>}
                      </td>
                    )}
                    <td className="px-4 py-3">{effortBadge(row.effort)}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs max-w-[300px]">{desc}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
