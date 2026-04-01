import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, CheckCircle2 } from 'lucide-react';
import { PriorityBadge } from './PriorityBadge';

interface TopActionsTableProps {
  data: any[] | Record<string, any[]>;
}

interface FlatAction {
  action: string;
  priority: string;
  quickWin: boolean;
}

function flattenActions(data: any[] | Record<string, any[]>): FlatAction[] {
  if (Array.isArray(data)) {
    return data.map(a => ({
      action: a.action || a.recommendation || a.description || '',
      priority: a.priority || 'P1',
      quickWin: !!a.quick_win,
    }));
  }
  // Grouped object format
  const rows: FlatAction[] = [];
  const grouped = data as Record<string, any[]>;
  (grouped.p0_immediate_risk_mitigation || []).forEach((a: any) =>
    rows.push({ action: a.action || '', priority: a.priority || 'P0', quickWin: !!a.quick_win })
  );
  (grouped.p1_systemic_process_redesign || []).forEach((a: any) =>
    rows.push({ action: a.action || '', priority: a.priority || 'P1', quickWin: !!a.quick_win })
  );
  (grouped.quick_wins || []).forEach((a: any) =>
    rows.push({ action: a.action || '', priority: a.priority || 'Quick Win', quickWin: true })
  );
  return rows;
}

function priorityOrder(p: string): number {
  const upper = p.toUpperCase();
  if (upper.includes('P0')) return 0;
  if (upper.includes('P1')) return 1;
  if (upper.includes('P2')) return 2;
  return 3;
}

function priorityBorderColor(p: string): string {
  const upper = p.toUpperCase();
  if (upper.includes('P0')) return 'border-l-destructive';
  if (upper.includes('P1')) return 'border-l-amber-500';
  if (upper.includes('P2')) return 'border-l-blue-500';
  return 'border-l-muted';
}

export function TopActionsTable({ data }: TopActionsTableProps) {
  const rows = flattenActions(data).sort((a, b) => priorityOrder(a.priority) - priorityOrder(b.priority));

  if (!rows.length) return (
    <Card className="shadow-sm">
      <CardContent className="py-8 text-center text-sm text-muted-foreground">
        No actions in this report.
      </CardContent>
    </Card>
  );

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
            <Target className="w-4 h-4 text-primary" />
          </div>
          Top Actions
          <Badge variant="secondary" className="ml-auto">{rows.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 w-20">Priority</th>
                <th className="px-2 py-2">Action</th>
                <th className="px-2 py-2 w-24 text-center">Quick Win</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  className={`border-b border-border last:border-0 border-l-4 ${priorityBorderColor(row.priority)}`}
                >
                  <td className="px-4 py-3">
                    <PriorityBadge priority={row.priority} />
                  </td>
                  <td className="px-2 py-3">
                    <p className="text-foreground text-[13px] leading-relaxed">{row.action}</p>
                  </td>
                  <td className="px-2 py-3 text-center">
                    {row.quickWin ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
