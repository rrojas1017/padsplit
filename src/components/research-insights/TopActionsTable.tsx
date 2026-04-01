import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Target, ChevronDown, ChevronRight, Users, Download } from 'lucide-react';
import { PriorityBadge } from './PriorityBadge';
import { exportByKeywords } from '@/utils/researchExport';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { TopAction } from '@/types/research-insights';

interface TopActionsTableProps {
  data: TopAction[] | Record<string, TopAction[]>;
}

interface FlatAction extends TopAction {
  _group: string;
  quotes?: string[];
  keywords?: string[];
}

function normalizeAction(a: any): TopAction & { quotes?: string[]; keywords?: string[] } {
  return {
    action: a.action || a.recommendation || a.description || '',
    impact: a.impact || a.rationale || a.expected_impact || '',
    priority: a.priority || 'P1',
    owner: a.owner || a.ownership || undefined,
    effort: a.effort || undefined,
    rank: a.rank || undefined,
    cases: a.cases || a.member_count || a.affected_members || undefined,
    timeline: a.timeline || undefined,
    quotes: a.quotes || a.supporting_quotes || a.example_quotes || [],
    keywords: a.keywords || a.related_codes || [],
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

function extractKeywords(action: string): string[] {
  return action.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 4).slice(0, 6);
}

interface AffectedMember {
  memberName: string;
  phone: string;
  bookingId: string;
  quote: string;
}

function ActionRow({ row, hasOwner }: { row: FlatAction; hasOwner: boolean }) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<AffectedMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [exporting, setExporting] = useState(false);

  const desc = row.impact || (row as any).description || (row as any).rationale || '';
  const owner = row.owner || (row as any).ownership;
  const memberCount = row.cases ?? 0;
  const quotes = row.quotes || [];
  const keywords = row.keywords?.length ? row.keywords : extractKeywords(row.action);

  useEffect(() => {
    if (!open || members.length > 0 || loadingMembers) return;
    setLoadingMembers(true);
    const kw = keywords.map(k => k.toLowerCase());
    if (!kw.length) { setLoadingMembers(false); return; }

    supabase
      .from('booking_transcriptions')
      .select('booking_id, research_classification, bookings!inner(member_name, contact_phone, record_type, has_valid_conversation)')
      .eq('research_processing_status', 'completed')
      .not('research_classification', 'is', null)
      .then(({ data: rows }) => {
        const matched: AffectedMember[] = [];
        for (const r of rows || []) {
          const b = r.bookings as any;
          if (b?.record_type !== 'research' || !b?.has_valid_conversation) continue;
          const cls = r.research_classification as any;
          const text = [
            cls?.primary_reason_code, cls?.root_cause_summary, cls?.root_cause,
            ...(cls?.sub_reasons || []),
          ].filter(Boolean).join(' ').toLowerCase();
          if (kw.some(k => text.includes(k))) {
            matched.push({
              memberName: b?.member_name || 'Unknown',
              phone: b?.contact_phone || '',
              bookingId: r.booking_id,
              quote: cls?.key_quote || cls?.supporting_quote || '',
            });
          }
        }
        setMembers(matched);
        setLoadingMembers(false);
      });
  }, [open]);

  const handleExport = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExporting(true);
    try {
      const count = await exportByKeywords(keywords, `action_${row.action.substring(0, 30).replace(/\s+/g, '_')}.csv`);
      toast.success(`Exported ${count} records`);
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <tr className={`border-b border-border last:border-0 border-l-4 ${groupBorderColor(row._group)} cursor-pointer hover:bg-muted/30 transition-colors`}>
          <td className="px-4 py-3 w-8">
            {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </td>
          <td className="px-2 py-3 w-20">
            <PriorityBadge priority={row.priority} />
          </td>
          <td className="px-2 py-3 max-w-[320px]">
            <span className="text-foreground font-medium text-[13px] leading-snug line-clamp-2" title={row.action}>{row.action}</span>
          </td>
          <td className="px-2 py-3 w-28">
            {memberCount > 0 ? (
              <span className="flex items-center gap-1 text-xs font-medium text-foreground">
                <Users className="w-3 h-3 text-muted-foreground" />{memberCount} members
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </td>
          {hasOwner && (
            <td className="px-2 py-3 w-24">
              {owner && <Badge variant="outline" className="text-xs">{owner}</Badge>}
            </td>
          )}
          <td className="px-2 py-3 w-20">{effortBadge(row.effort)}</td>
          <td className="px-2 py-3 max-w-[180px]">
            <span className="text-muted-foreground text-xs line-clamp-1" title={desc}>{desc}</span>
          </td>
          <td className="px-2 py-3 w-10">
            <Button variant="ghost" size="icon" className="h-6 w-6" disabled={exporting} onClick={handleExport} title="Export affected members">
              <Download className="w-3 h-3" />
            </Button>
          </td>
        </tr>
      </CollapsibleTrigger>

      <CollapsibleContent asChild>
        <tr className={`border-b border-border border-l-4 ${groupBorderColor(row._group)} bg-muted/20`}>
          <td colSpan={hasOwner ? 8 : 7} className="px-6 py-4">
            <div className="space-y-3">
              {/* Full description */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Full Action</p>
                <p className="text-sm text-foreground">{row.action}</p>
                {desc && <p className="text-xs text-muted-foreground mt-1">{desc}</p>}
              </div>

              {/* Quotes */}
              {quotes.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Supporting Evidence</p>
                  <div className="space-y-2">
                    {quotes.slice(0, 3).map((q, qi) => (
                      <blockquote key={qi} className="border-l-2 border-accent pl-3 italic text-xs text-muted-foreground">"{q}"</blockquote>
                    ))}
                  </div>
                </div>
              )}

              {/* Members preview */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Affected Members {loadingMembers ? '…' : `(${members.length})`}
                  </p>
                  {members.length > 0 && (
                    <Button variant="ghost" size="sm" className="h-6 text-xs text-primary" disabled={exporting} onClick={handleExport}>
                      <Download className="w-3 h-3 mr-1" />Export all
                    </Button>
                  )}
                </div>
                {members.length > 0 ? (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="text-left p-2 font-medium text-muted-foreground">Name</th>
                          <th className="text-left p-2 font-medium text-muted-foreground">Phone</th>
                          <th className="text-left p-2 font-medium text-muted-foreground hidden md:table-cell">Quote</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.slice(0, 5).map((m, mi) => (
                          <tr key={mi} className="border-t border-border">
                            <td className="p-2 text-foreground">{m.memberName}</td>
                            <td className="p-2 text-muted-foreground">{m.phone}</td>
                            <td className="p-2 text-muted-foreground truncate max-w-[200px] hidden md:table-cell">{m.quote || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {members.length > 5 && (
                      <div className="p-2 text-center border-t border-border text-xs text-muted-foreground">
                        + {members.length - 5} more members
                      </div>
                    )}
                  </div>
                ) : !loadingMembers ? (
                  <p className="text-xs text-muted-foreground italic">No matching records found</p>
                ) : null}
              </div>
            </div>
          </td>
        </tr>
      </CollapsibleContent>
    </Collapsible>
  );
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
                <th className="px-4 py-2 w-8"></th>
                <th className="px-2 py-2 w-20">Priority</th>
                <th className="px-2 py-2">Action</th>
                <th className="px-2 py-2 w-28">Impact</th>
                {hasOwner && <th className="px-2 py-2 w-24">Owner</th>}
                <th className="px-2 py-2 w-20">Effort</th>
                <th className="px-2 py-2">Details</th>
                <th className="px-2 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <ActionRow key={i} row={row} hasOwner={hasOwner} />
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
