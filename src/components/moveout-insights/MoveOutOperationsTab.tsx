import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Home, ChevronDown } from 'lucide-react';
import { PriorityBadge } from '@/components/research-insights/PriorityBadge';
import { PaymentFrictionCard } from '@/components/research-insights/PaymentFrictionCard';
import { TransferFrictionCard } from '@/components/research-insights/TransferFrictionCard';
import { AgentPerformanceCard } from '@/components/research-insights/AgentPerformanceCard';
import { stripUUIDs, parseSeverityLevel } from './utils';
import type { ResearchInsightData, HostAccountabilityFlag } from '@/types/research-insights';

interface MoveOutOperationsTabProps {
  reportData: ResearchInsightData;
}

function parseFlagSeverity(sev?: string): { priority: string; level: number } {
  if (!sev) return { priority: '', level: 3 };
  const lower = sev.toLowerCase();
  if (lower.includes('p0') || lower.includes('critical')) return { priority: 'P0', level: 0 };
  if (lower.includes('p1') || lower.includes('high')) return { priority: 'P1', level: 1 };
  if (lower.includes('p2')) return { priority: 'P2', level: 2 };
  return { priority: '', level: 3 };
}

export function MoveOutOperationsTab({ reportData }: MoveOutOperationsTabProps) {
  const [showAllFlags, setShowAllFlags] = useState(false);

  const flags = reportData.host_accountability_flags || [];
  const hasFlags = flags.length > 0;
  const hasFriction = !!(reportData.payment_friction_analysis || reportData.transfer_friction_analysis);
  const hasAgent = !!reportData.agent_performance_summary;

  const sortedFlags = useMemo(() => {
    return [...flags]
      .map((f) => ({ ...f, ...parseFlagSeverity(f.severity) }))
      .sort((a, b) => a.level - b.level);
  }, [flags]);

  const visibleFlags = showAllFlags ? sortedFlags : sortedFlags.slice(0, 10);

  if (!hasFlags && !hasFriction && !hasAgent) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        No operations data available in this report.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Host Accountability Flags — as table */}
      {hasFlags && (
        <Card className="shadow-sm rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-destructive/10 flex items-center justify-center">
                <Home className="w-4 h-4 text-destructive" />
              </div>
              Host Accountability Flags
              <Badge variant="secondary" className="ml-auto">{flags.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Severity</TableHead>
                    <TableHead>Flag</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleFlags.map((flag, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <PriorityBadge priority={flag.priority} />
                      </TableCell>
                      <TableCell className="text-sm text-foreground">
                        {stripUUIDs(flag.flag || flag.issue || flag.description || '—')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {flags.length > 10 && (
              <div className="p-3 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllFlags(!showAllFlags)}
                  className="w-full text-xs"
                >
                  {showAllFlags ? 'Show fewer' : `Show all ${flags.length} flags`}
                  <ChevronDown className={`w-3.5 h-3.5 ml-1 transition-transform ${showAllFlags ? 'rotate-180' : ''}`} />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Friction Cards */}
      {hasFriction && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {reportData.payment_friction_analysis && (
            <PaymentFrictionCard data={reportData.payment_friction_analysis} />
          )}
          {reportData.transfer_friction_analysis && (
            <TransferFrictionCard data={reportData.transfer_friction_analysis} />
          )}
        </div>
      )}

      {/* Agent Performance */}
      {hasAgent && (
        <AgentPerformanceCard data={reportData.agent_performance_summary as any} />
      )}
    </div>
  );
}
