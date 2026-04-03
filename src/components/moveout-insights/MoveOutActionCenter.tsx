import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Target, ChevronDown } from 'lucide-react';
import { stripUUIDs, parseSeverityLevel } from './utils';
import type { EmergingPattern } from '@/types/research-insights';

interface MoveOutActionCenterProps {
  data: EmergingPattern[];
}

function getSeverityLabel(pattern: EmergingPattern): string {
  if (pattern.watch_or_act === 'act_now' || pattern.status === 'act_now') return 'Act Now';
  if (pattern.watch_or_act === 'investigate' || pattern.status === 'investigate') return 'Investigate';
  return 'Monitor';
}

function parsePatternTitle(text: string): string {
  const match = text.match(/^\*\*([^*]+)\*\*/);
  if (match) return match[1];
  const dotIdx = text.indexOf('. ');
  if (dotIdx > 0 && dotIdx < 80) return text.slice(0, dotIdx);
  return text;
}

function extractWhoWhat(description: string): string {
  if (!description) return 'Multiple cases';
  const lower = description.toLowerCase();

  // Try to extract agent names: "Agent Amir", "Agent (Joseph)", "agent named Amir"
  const agentMatches = description.match(/\bAgent\s+\(?([A-Z][a-z]+)\)?/g);
  if (agentMatches && agentMatches.length > 0) {
    const names = agentMatches
      .map(m => m.replace(/^Agent\s+\(?/, '').replace(/\)?$/, ''))
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 3);
    if (names.length > 0) return names.join(', ');
  }

  if (lower.includes('host')) return 'Host issues';
  if (lower.includes('onboarding') || lower.includes('welcome')) return 'Onboarding';
  if (lower.includes('payment') || lower.includes('billing')) return 'Payment process';
  if (lower.includes('transfer')) return 'Transfer process';
  if (lower.includes('listing') || lower.includes('photo')) return 'Property listings';
  if (lower.includes('roommate') || lower.includes('room mate')) return 'Roommate matching';
  if (lower.includes('communication') || lower.includes('follow-up') || lower.includes('followup')) return 'CX team';
  if (lower.includes('property') || lower.includes('maintenance')) return 'Property ops';
  return 'Multiple cases';
}

function suggestAction(pattern: string, description: string): string {
  const text = `${pattern} ${description}`.toLowerCase();
  if ((text.includes('agent') && (text.includes('listen') || text.includes('dismiss') || text.includes('garble') || text.includes('script') || text.includes('prep') || text.includes('performance')))) return 'Schedule coaching review';
  if (text.includes('unaware') || text.includes("didn't know") || text.includes('not aware')) return 'Update onboarding flow';
  if (text.includes('communication') && (text.includes('follow') || text.includes('escalat'))) return 'Audit escalation SLA';
  if (text.includes('listing') || text.includes('photo') || text.includes('property condition')) return 'Audit flagged listings';
  if (text.includes('payment') || text.includes('billing') || text.includes('charge')) return 'Review payment process';
  if (text.includes('transfer')) return 'Review transfer workflow';
  if (text.includes('roommate') || text.includes('room mate') || text.includes('matching')) return 'Review matching criteria';
  if (text.includes('host') || text.includes('landlord')) return 'Flag host for review';
  if (text.includes('maintenance') || text.includes('repair')) return 'Escalate maintenance tickets';
  return 'Review flagged cases';
}

function isGarbage(cleaned: string): boolean {
  if (cleaned.length < 20) return true;
  const commas = (cleaned.match(/,/g) || []).length;
  const words = cleaned.split(/\s+/).length;
  return commas > words;
}

export function MoveOutActionCenter({ data }: MoveOutActionCenterProps) {
  const [showAll, setShowAll] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (!data?.length) return null;

  const cleaned = data
    .map((p) => {
      const title = stripUUIDs(parsePatternTitle(p.pattern));
      const desc = stripUUIDs(p.description || '');
      return { ...p, cleanTitle: title, cleanDesc: desc };
    })
    .filter((p) => !isGarbage(p.cleanDesc))
    .sort((a, b) => (b.frequency || 0) - (a.frequency || 0));

  if (!cleaned.length) return null;

  const visible = showAll ? cleaned : cleaned.slice(0, 10);

  return (
    <Card className="shadow-sm rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
            <Target className="w-4 h-4 text-primary" />
          </div>
          Action Center
          <Badge variant="secondary" className="ml-auto text-xs">{cleaned.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <TooltipProvider>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[90px] text-xs uppercase tracking-wide">Priority</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Pattern</TableHead>
                <TableHead className="text-xs uppercase tracking-wide w-[140px]">Who / What</TableHead>
                <TableHead className="text-xs uppercase tracking-wide w-[70px] text-right">Cases</TableHead>
                <TableHead className="text-xs uppercase tracking-wide w-[200px]">Suggested Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((p, i) => {
                const severity = getSeverityLabel(p);
                const { bgClass, textClass } = parseSeverityLevel(severity);
                const whoWhat = extractWhoWhat(p.cleanDesc);
                const action = suggestAction(p.cleanTitle, p.cleanDesc);
                const isExpanded = expandedIdx === i;
                const truncated = p.cleanTitle.length > 40 ? p.cleanTitle.slice(0, 40) + '…' : p.cleanTitle;

                return (
                  <>
                    <TableRow
                      key={i}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setExpandedIdx(isExpanded ? null : i)}
                    >
                      <TableCell>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${bgClass} ${textClass}`}>
                          {severity === 'Act Now' ? '🔴 Act' : severity === 'Investigate' ? '🟡 Inv.' : '🔵 Mon.'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {p.cleanTitle.length > 40 ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm font-medium">{truncated}</span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <p className="text-sm">{p.cleanTitle}</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-sm font-medium">{p.cleanTitle}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{whoWhat}</TableCell>
                      <TableCell className="text-right font-mono font-semibold text-sm">{p.frequency || 0}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{action}</TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`exp-${i}`}>
                        <TableCell colSpan={5} className="bg-muted/30 px-6 py-3">
                          <p className="text-sm text-muted-foreground leading-relaxed">{p.cleanDesc}</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </TooltipProvider>
        {cleaned.length > 10 && (
          <div className="px-4 pb-3 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAll(!showAll)}
              className="w-full text-xs"
            >
              {showAll ? 'Show fewer' : `Show all ${cleaned.length} patterns`}
              <ChevronDown className={`w-3.5 h-3.5 ml-1 transition-transform ${showAll ? 'rotate-180' : ''}`} />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
