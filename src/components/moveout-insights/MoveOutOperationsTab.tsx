import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Home, ChevronDown, AlertTriangle, Users, Shield } from 'lucide-react';
import { PaymentFrictionCard } from '@/components/research-insights/PaymentFrictionCard';
import { TransferFrictionCard } from '@/components/research-insights/TransferFrictionCard';
import { stripUUIDs } from './utils';
import type { ResearchInsightData } from '@/types/research-insights';

interface MoveOutOperationsTabProps {
  reportData: ResearchInsightData;
}

function impactToPriority(retention?: string, legal?: string): { label: string; level: number; variant: 'destructive' | 'default' | 'secondary' | 'outline' } {
  if (retention === 'high' && legal === 'high') return { label: 'Critical', level: 0, variant: 'destructive' };
  if (retention === 'high' || legal === 'high') return { label: 'High', level: 1, variant: 'default' };
  if (retention === 'medium' || legal === 'medium') return { label: 'Medium', level: 2, variant: 'secondary' };
  return { label: 'Low', level: 3, variant: 'outline' };
}

export function MoveOutOperationsTab({ reportData }: MoveOutOperationsTabProps) {
  const [showAllFlags, setShowAllFlags] = useState(false);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const rawFlags = reportData.host_accountability_flags || [];
  const hasFriction = !!(reportData.payment_friction_analysis || reportData.transfer_friction_analysis);
  const agentPerf = reportData.agent_performance_summary;
  const hasAgent = !!(agentPerf?.strengths?.length || agentPerf?.areas_for_improvement?.length || agentPerf?.recommendations?.length);

  // Parse flags with actual data shape
  const sortedFlags = useMemo(() => {
    return rawFlags
      .map((f: any, i: number) => {
        const issuePattern = f.issue_pattern || f.flag || f.issue || f.description || '';
        const cleaned = stripUUIDs(issuePattern);
        if (!cleaned || cleaned.length < 10) return null;

        const priority = impactToPriority(f.impact_on_retention, f.impact_on_legal_risk);
        return {
          index: i,
          issuePattern: cleaned,
          enforcement: stripUUIDs(f.recommended_enforcement || ''),
          systemicFix: stripUUIDs(f.systemic_fix || ''),
          frequency: f.frequency || f.member_count || f.cases || 0,
          retentionImpact: f.impact_on_retention || 'unknown',
          legalRisk: f.impact_on_legal_risk || 'unknown',
          priority,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.priority.level - b.priority.level || b.frequency - a.frequency);
  }, [rawFlags]);

  const visibleFlags = showAllFlags ? sortedFlags : sortedFlags.slice(0, 10);

  if (!sortedFlags.length && !hasFriction && !hasAgent) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        No operations data available in this report.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Host Accountability Flags */}
      {sortedFlags.length > 0 && (
        <Card className="shadow-sm rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-destructive/10 flex items-center justify-center">
                <Home className="w-4 h-4 text-destructive" />
              </div>
              Host Accountability Flags
              <Badge variant="secondary" className="ml-auto">{sortedFlags.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Severity</TableHead>
                    <TableHead>Issue Pattern</TableHead>
                    <TableHead className="w-20 text-right">Cases</TableHead>
                    <TableHead className="w-24">Retention</TableHead>
                    <TableHead className="w-24">Legal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleFlags.map((flag: any) => (
                    <>
                      <TableRow
                        key={flag.index}
                        className="cursor-pointer"
                        onClick={() => setExpandedRow(expandedRow === flag.index ? null : flag.index)}
                      >
                        <TableCell>
                          <Badge variant={flag.priority.variant} className="text-xs">
                            {flag.priority.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-foreground max-w-md">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="line-clamp-2">{flag.issuePattern}</span>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-sm">
                                <p className="text-xs">{flag.issuePattern}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-sm">
                          {flag.frequency || '—'}
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs font-medium ${flag.retentionImpact === 'high' ? 'text-destructive' : flag.retentionImpact === 'medium' ? 'text-amber-600' : 'text-muted-foreground'}`}>
                            {flag.retentionImpact}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs font-medium ${flag.legalRisk === 'high' ? 'text-destructive' : flag.legalRisk === 'medium' ? 'text-amber-600' : 'text-muted-foreground'}`}>
                            {flag.legalRisk}
                          </span>
                        </TableCell>
                      </TableRow>
                      {expandedRow === flag.index && (
                        <TableRow key={`${flag.index}-detail`}>
                          <TableCell colSpan={5} className="bg-muted/30 px-6 py-4">
                            <div className="space-y-2 text-sm">
                              {flag.enforcement && (
                                <div>
                                  <span className="font-medium text-foreground">Recommended Enforcement: </span>
                                  <span className="text-muted-foreground">{flag.enforcement}</span>
                                </div>
                              )}
                              {flag.systemicFix && (
                                <div>
                                  <span className="font-medium text-foreground">Systemic Fix: </span>
                                  <span className="text-muted-foreground">{flag.systemicFix}</span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
            {sortedFlags.length > 10 && (
              <div className="p-3 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllFlags(!showAllFlags)}
                  className="w-full text-xs"
                >
                  {showAllFlags ? 'Show fewer' : `Show all ${sortedFlags.length} flags`}
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
        <Card className="shadow-sm rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-primary" />
              </div>
              Agent Performance Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {agentPerf?.strengths && agentPerf.strengths.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-emerald-600" />
                  Strengths
                </h4>
                <ul className="space-y-1">
                  {agentPerf.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-muted-foreground pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-emerald-500">
                      {stripUUIDs(s)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(agentPerf?.areas_for_improvement || agentPerf?.weaknesses)?.length ? (
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  Areas for Improvement
                </h4>
                <ul className="space-y-1">
                  {(agentPerf?.areas_for_improvement || agentPerf?.weaknesses || []).map((s, i) => (
                    <li key={i} className="text-sm text-muted-foreground pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-amber-500">
                      {stripUUIDs(s)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {agentPerf?.recommendations && agentPerf.recommendations.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">Recommendations</h4>
                <ul className="space-y-1">
                  {agentPerf.recommendations.map((s, i) => (
                    <li key={i} className="text-sm text-muted-foreground pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-primary">
                      {stripUUIDs(s)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
