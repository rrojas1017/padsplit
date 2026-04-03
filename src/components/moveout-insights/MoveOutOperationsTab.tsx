import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Home, ChevronDown, AlertTriangle, Users, Shield, Download, Info } from 'lucide-react';
import { PaymentFrictionCard } from '@/components/research-insights/PaymentFrictionCard';
import { TransferFrictionCard } from '@/components/research-insights/TransferFrictionCard';
import { stripUUIDs } from './utils';
import type { ResearchInsightData, HostAccountabilityFlag } from '@/types/research-insights';

interface MoveOutOperationsTabProps {
  reportData: ResearchInsightData;
}

// ── Categorize an issue_pattern string into a host/property group ──
function categorizeFlag(pattern: string): string {
  const lower = pattern.toLowerCase();
  if (/threat|evict|insult|retali|intimidat|hostile|harass/i.test(lower)) return 'Host Misconduct & Threats';
  if (/pest|mold|infest|roach|bedbug|rodent/i.test(lower)) return 'Pest & Mold Issues';
  if (/maintenance|repair|disrepair|broken|plumbing|hvac|leak/i.test(lower)) return 'Maintenance Neglect';
  if (/unsafe|safety|hazard|fire|security|lock/i.test(lower)) return 'Safety & Security';
  if (/unresponsiv|communicat|ignore|no.?response|ghosting/i.test(lower)) return 'Host Unresponsiveness';
  if (/payment|billing|fee|charge|rent|financial/i.test(lower)) return 'Payment & Billing Disputes';
  if (/clean|sanit|hygiene|dirty|filth/i.test(lower)) return 'Cleanliness & Sanitation';
  if (/roommate|shared|living.?situation|conflict/i.test(lower)) return 'Roommate Conflicts';
  if (/listing|photo|misrepresent|advertis/i.test(lower)) return 'Listing Misrepresentation';
  if (/transfer|reloc|move/i.test(lower)) return 'Transfer & Relocation Issues';
  return 'Other Host Issues';
}

function severityFromImpact(retention?: string, legal?: string): { label: string; level: number; variant: 'destructive' | 'default' | 'secondary' | 'outline' } {
  if (retention === 'high' && legal === 'high') return { label: 'Critical', level: 0, variant: 'destructive' };
  if (retention === 'high' || legal === 'high') return { label: 'High', level: 1, variant: 'default' };
  if (retention === 'medium' || legal === 'medium') return { label: 'Medium', level: 2, variant: 'secondary' };
  return { label: 'Low', level: 3, variant: 'outline' };
}

interface HostGroup {
  category: string;
  totalFlags: number;
  totalCases: number;
  worstSeverity: ReturnType<typeof severityFromImpact>;
  topIssues: Array<{ issue: string; cases: number }>;
  flags: Array<{
    issuePattern: string;
    frequency: number;
    retention: string;
    legal: string;
    enforcement: string;
    systemicFix: string;
    severity: ReturnType<typeof severityFromImpact>;
  }>;
}

function exportHostCSV(groups: HostGroup[]) {
  const rows = [['Category', 'Issue Pattern', 'Cases', 'Retention Impact', 'Legal Risk', 'Recommended Enforcement', 'Systemic Fix'].join(',')];
  groups.forEach(g => {
    g.flags.forEach(f => {
      rows.push([
        `"${g.category}"`,
        `"${f.issuePattern.replace(/"/g, '""')}"`,
        String(f.frequency),
        f.retention,
        f.legal,
        `"${f.enforcement.replace(/"/g, '""')}"`,
        `"${f.systemicFix.replace(/"/g, '""')}"`,
      ].join(','));
    });
  });
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `host-accountability-flags-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function MoveOutOperationsTab({ reportData }: MoveOutOperationsTabProps) {
  const [showAll, setShowAll] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const rawFlags: HostAccountabilityFlag[] = reportData.host_accountability_flags || [];
  const hasFriction = !!(reportData.payment_friction_analysis || reportData.transfer_friction_analysis);
  const agentPerf = reportData.agent_performance_summary;
  const hasAgent = !!(agentPerf?.strengths?.length || agentPerf?.areas_for_improvement?.length || agentPerf?.recommendations?.length);

  // Group flags by host/property category
  const hostGroups = useMemo<HostGroup[]>(() => {
    const groups: Record<string, HostGroup> = {};

    rawFlags.forEach((f) => {
      const pattern = f.issue_pattern || f.flag || f.issue || f.description || '';
      const cleaned = stripUUIDs(pattern);
      if (!cleaned || cleaned.length < 10) return;

      const category = categorizeFlag(cleaned);
      const severity = severityFromImpact(
        (f as any).impact_on_retention,
        (f as any).impact_on_legal_risk
      );
      const freq = (f as any).frequency || f.member_count || f.cases || 1;

      if (!groups[category]) {
        groups[category] = {
          category,
          totalFlags: 0,
          totalCases: 0,
          worstSeverity: { label: 'Low', level: 3, variant: 'outline' },
          topIssues: [],
          flags: [],
        };
      }

      const g = groups[category];
      g.totalFlags++;
      g.totalCases += freq;
      if (severity.level < g.worstSeverity.level) g.worstSeverity = severity;

      g.flags.push({
        issuePattern: cleaned,
        frequency: freq,
        retention: (f as any).impact_on_retention || 'unknown',
        legal: (f as any).impact_on_legal_risk || 'unknown',
        enforcement: stripUUIDs((f as any).recommended_enforcement || ''),
        systemicFix: stripUUIDs((f as any).systemic_fix || ''),
        severity,
      });
    });

    // Build topIssues summary for each group
    Object.values(groups).forEach(g => {
      // Sort flags within group by frequency desc
      g.flags.sort((a, b) => b.frequency - a.frequency);
      // Top 3 issues as pills
      g.topIssues = g.flags.slice(0, 3).map(f => ({
        issue: f.issuePattern.length > 50 ? f.issuePattern.slice(0, 47) + '…' : f.issuePattern,
        cases: f.frequency,
      }));
    });

    return Object.values(groups).sort((a, b) => b.totalCases - a.totalCases);
  }, [rawFlags]);

  const visibleGroups = showAll ? hostGroups : hostGroups.slice(0, 10);

  // Quick stats
  const criticalCount = hostGroups.filter(g => g.worstSeverity.label === 'Critical').length;
  const totalCases = hostGroups.reduce((sum, g) => sum + g.totalCases, 0);

  // Check if we have real host/property identifiers (we don't currently)
  const hasHostIdentifiers = false; // Will be true when pipeline adds host_name/property_address

  if (!hostGroups.length && !hasFriction && !hasAgent) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        No operations data available in this report.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Banner: host data not yet available */}
      {!hasHostIdentifiers && hostGroups.length > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm">
          <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <span className="font-medium text-amber-800">Grouped by issue category.</span>{' '}
            <span className="text-amber-700">
              Host and property identifiers are not yet included in the AI extraction pipeline. 
              Once <code className="text-xs bg-amber-100 px-1 rounded">host_name</code> and <code className="text-xs bg-amber-100 px-1 rounded">property_address</code> fields 
              are added to the move-out survey extraction, this view will show per-host grouping.
            </span>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      {hostGroups.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border rounded-lg px-4 py-3 text-center">
            <div className="text-2xl font-bold text-foreground">{hostGroups.length}</div>
            <div className="text-xs text-muted-foreground">Issue categories flagged</div>
          </div>
          <div className="bg-card border rounded-lg px-4 py-3 text-center">
            <div className="text-2xl font-bold text-foreground">{totalCases}</div>
            <div className="text-xs text-muted-foreground">Total cases affected</div>
          </div>
          <div className="bg-card border rounded-lg px-4 py-3 text-center">
            <div className="text-2xl font-bold text-destructive">{criticalCount}</div>
            <div className="text-xs text-muted-foreground">Critical severity</div>
          </div>
        </div>
      )}

      {/* Host Accountability Flags — grouped */}
      {hostGroups.length > 0 && (
        <Card className="shadow-sm rounded-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-destructive/10 flex items-center justify-center">
                  <Home className="w-4 h-4 text-destructive" />
                </div>
                Host Accountability Flags
                <Badge variant="secondary">{rawFlags.length} flags across {hostGroups.length} categories</Badge>
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => exportHostCSV(hostGroups)} className="text-xs gap-1.5">
                <Download className="w-3.5 h-3.5" /> Export All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-24 text-xs uppercase tracking-wide">Severity</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide">Category</TableHead>
                    <TableHead className="w-20 text-right text-xs uppercase tracking-wide">Flags</TableHead>
                    <TableHead className="w-20 text-right text-xs uppercase tracking-wide">Cases</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide">Top Issues</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleGroups.map((group) => (
                    <TooltipProvider key={group.category}>
                      {/* Main row */}
                      <TableRow
                        className="cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => setExpandedGroup(expandedGroup === group.category ? null : group.category)}
                      >
                        <TableCell>
                          <Badge variant={group.worstSeverity.variant} className="text-xs">
                            {group.worstSeverity.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium text-sm text-foreground">
                          {group.category}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-sm">
                          {group.totalFlags}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-sm">
                          {group.totalCases}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="flex flex-wrap gap-1">
                            {group.topIssues.map((ti, i) => (
                              <Tooltip key={i}>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded-full truncate max-w-[200px]">
                                    {ti.issue.length > 35 ? ti.issue.slice(0, 32) + '…' : ti.issue}
                                    <span className="text-muted-foreground">({ti.cases})</span>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-sm">
                                  <p className="text-xs">{ti.issue}</p>
                                </TooltipContent>
                              </Tooltip>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Expanded drill-down */}
                      {expandedGroup === group.category && (
                        <TableRow>
                          <TableCell colSpan={5} className="bg-muted/20 p-0">
                            <div className="px-6 py-3">
                              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                                Individual flags in "{group.category}"
                              </div>
                              <Table>
                                <TableHeader>
                                  <TableRow className="border-b border-border/50">
                                    <TableHead className="text-xs w-20">Severity</TableHead>
                                    <TableHead className="text-xs">Issue Pattern</TableHead>
                                    <TableHead className="text-xs w-16 text-right">Cases</TableHead>
                                    <TableHead className="text-xs w-20">Retention</TableHead>
                                    <TableHead className="text-xs w-20">Legal</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {group.flags.map((flag, i) => (
                                    <TableRow key={i} className="border-b border-border/30">
                                      <TableCell>
                                        <Badge variant={flag.severity.variant} className="text-[10px]">
                                          {flag.severity.label}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-xs text-foreground">
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <span className="line-clamp-2">{flag.issuePattern}</span>
                                          </TooltipTrigger>
                                          <TooltipContent side="bottom" className="max-w-md">
                                            <p className="text-xs">{flag.issuePattern}</p>
                                            {flag.enforcement && (
                                              <p className="text-xs mt-1"><strong>Enforcement:</strong> {flag.enforcement}</p>
                                            )}
                                            {flag.systemicFix && (
                                              <p className="text-xs mt-1"><strong>Systemic Fix:</strong> {flag.systemicFix}</p>
                                            )}
                                          </TooltipContent>
                                        </Tooltip>
                                      </TableCell>
                                      <TableCell className="text-right font-mono text-xs font-semibold">
                                        {flag.frequency}
                                      </TableCell>
                                      <TableCell>
                                        <span className={`text-xs font-medium ${flag.retention === 'high' ? 'text-destructive' : flag.retention === 'medium' ? 'text-amber-600' : 'text-muted-foreground'}`}>
                                          {flag.retention}
                                        </span>
                                      </TableCell>
                                      <TableCell>
                                        <span className={`text-xs font-medium ${flag.legal === 'high' ? 'text-destructive' : flag.legal === 'medium' ? 'text-amber-600' : 'text-muted-foreground'}`}>
                                          {flag.legal}
                                        </span>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TooltipProvider>
                  ))}
                </TableBody>
              </Table>
            </div>
            {hostGroups.length > 10 && (
              <div className="p-3 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAll(!showAll)}
                  className="w-full text-xs"
                >
                  {showAll ? 'Show fewer' : `Show all ${hostGroups.length} categories`}
                  <ChevronDown className={`w-3.5 h-3.5 ml-1 transition-transform ${showAll ? 'rotate-180' : ''}`} />
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
