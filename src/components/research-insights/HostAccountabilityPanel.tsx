import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Home, Download, ChevronDown, ChevronRight, Users } from 'lucide-react';
import { exportByKeywords } from '@/utils/researchExport';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface HostFlag {
  flag?: string;
  issue_pattern?: string;
  description?: string;
  priority?: string;
  quote?: string;
  recommendation?: string;
  frequency?: number;
  recommended_enforcement?: string;
  systemic_fix?: string;
  severity?: string;
  member_count?: number;
  cases?: number;
  quotes?: string[];
}

interface AffectedMember {
  memberName: string;
  phone: string;
  bookingId: string;
  quote: string;
}

interface HostAccountabilityPanelProps {
  data: HostFlag[];
  maxVisible?: number;
}

function inferSeverity(text: string): 'critical' | 'high' | 'medium' {
  const lower = text.toLowerCase();
  if (lower.includes('harassment') || lower.includes('assault') || lower.includes('discrimination') || lower.includes('illegal') || lower.includes('retaliat'))
    return 'critical';
  if (lower.includes('uninhabitable') || lower.includes('unsafe') || lower.includes('threatening') || lower.includes('negligence') || lower.includes('mold') || lower.includes('pest') || lower.includes('security'))
    return 'high';
  return 'medium';
}

function getSeverity(item: HostFlag, rawText: string): 'critical' | 'high' | 'medium' {
  if (item.severity) {
    const s = item.severity.toLowerCase();
    if (s === 'critical' || s === 'high' || s === 'medium') return s;
  }
  const p = (item.priority || '').toUpperCase();
  if (p.includes('P0')) return 'critical';
  if (p.includes('P1')) return 'high';
  return inferSeverity(rawText);
}

function getMemberCount(item: HostFlag): number {
  return item.member_count ?? item.cases ?? item.frequency ?? 0;
}

const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2 };
const severityColors: Record<string, { border: string; badge: string; badgeText: string }> = {
  critical: { border: 'hsl(var(--destructive))', badge: 'bg-destructive/15 text-destructive border-destructive/30', badgeText: 'Critical' },
  high: { border: 'hsl(45, 93%, 47%)', badge: 'bg-amber-500/15 text-amber-600 border-amber-500/30', badgeText: 'High' },
  medium: { border: 'hsl(var(--border))', badge: 'bg-muted text-muted-foreground border-border', badgeText: 'Medium' },
};

function getKeywords(title: string): string[] {
  return (title || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3);
}

function FlagRow({ item, rawItem }: { item: HostFlag; rawItem: any }) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<AffectedMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [exporting, setExporting] = useState(false);

  const title = item.flag || item.issue_pattern || '';
  const rawText = typeof rawItem === 'string' ? rawItem : title;
  const severity = getSeverity(item, rawText);
  const colors = severityColors[severity];
  const count = getMemberCount(item);
  const allQuotes = item.quotes || (item.quote ? [item.quote] : []);

  useEffect(() => {
    if (!open || members.length > 0 || loadingMembers) return;
    setLoadingMembers(true);
    const keywords = getKeywords(title);
    if (!keywords.length) { setLoadingMembers(false); return; }

    supabase
      .from('booking_transcriptions')
      .select('booking_id, research_classification, research_extraction, bookings!inner(member_name, contact_phone, record_type, has_valid_conversation)')
      .eq('research_processing_status', 'completed')
      .not('research_classification', 'is', null)
      .then(({ data: rows }) => {
        const matched: AffectedMember[] = [];
        for (const row of rows || []) {
          const b = row.bookings as any;
          if (b?.record_type !== 'research' || !b?.has_valid_conversation) continue;
          const cls = row.research_classification as any;
          const ext = row.research_extraction as any;
          const text = [
            cls?.primary_reason_code, cls?.root_cause_summary, cls?.root_cause,
            ...(cls?.sub_reasons || []),
            ext?.host_issues, ext?.safety_concerns,
          ].filter(Boolean).join(' ').toLowerCase();
          if (keywords.some(kw => text.includes(kw))) {
            matched.push({
              memberName: b?.member_name || 'Unknown',
              phone: b?.contact_phone || '',
              bookingId: row.booking_id,
              quote: cls?.key_quote || cls?.supporting_quote || '',
            });
          }
        }
        setMembers(matched);
        setLoadingMembers(false);
      });
  }, [open]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const keywords = getKeywords(title);
      const c = await exportByKeywords(keywords, `host_flag_${title.replace(/\s+/g, '_').substring(0, 30)}.csv`);
      toast.success(`Exported ${c} records`);
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className="border border-border rounded-lg overflow-hidden"
        style={{ borderLeftWidth: '4px', borderLeftColor: colors.border }}
      >
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors">
            {open ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{title}</p>
              {item.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{item.description}</p>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {count > 0 && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="w-3 h-3" />{count}
                </span>
              )}
              <Badge variant="outline" className={colors.badge}>{colors.badgeText}</Badge>
              <Button
                variant="ghost" size="icon" className="h-6 w-6"
                disabled={exporting}
                onClick={(e) => { e.stopPropagation(); handleExport(); }}
                title="Export members"
              >
                <Download className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
            {allQuotes.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Member Quotes</p>
                {allQuotes.slice(0, 3).map((q, qi) => (
                  <blockquote key={qi} className="border-l-2 border-accent pl-3 italic text-xs text-muted-foreground">"{q}"</blockquote>
                ))}
              </div>
            )}

            {(item.recommendation || item.recommended_enforcement) && (
              <div className="bg-muted/40 rounded-lg p-2">
                <p className="text-xs"><span className="font-medium text-foreground">Recommendation:</span> <span className="text-muted-foreground">{item.recommendation || item.recommended_enforcement}</span></p>
              </div>
            )}

            {item.systemic_fix && (
              <div className="bg-muted/40 rounded-lg p-2">
                <p className="text-xs"><span className="font-medium text-foreground">Systemic Fix:</span> <span className="text-muted-foreground">{item.systemic_fix}</span></p>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Affected Members {loadingMembers ? '…' : `(${members.length})`}
              </p>
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
                    <div className="p-2 text-center border-t border-border">
                      <Button variant="ghost" size="sm" onClick={handleExport} className="text-xs text-primary">
                        Export all {members.length} members
                      </Button>
                    </div>
                  )}
                </div>
              ) : !loadingMembers ? (
                <p className="text-xs text-muted-foreground italic">No matching records found</p>
              ) : null}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function HostAccountabilityPanel({ data, maxVisible }: HostAccountabilityPanelProps) {
  const [showAll, setShowAll] = useState(false);
  if (!data?.length) return null;

  const sorted = useMemo(() => {
    const items = data.map(rawItem => {
      const item: HostFlag = typeof rawItem === 'string' ? { flag: rawItem } : rawItem;
      const title = item.flag || item.issue_pattern || (typeof rawItem === 'string' ? rawItem : '');
      const severity = getSeverity(item, title);
      return { rawItem, item, severity, count: getMemberCount(item) };
    });
    items.sort((a, b) => (severityOrder[a.severity] - severityOrder[b.severity]) || (b.count - a.count));
    return items;
  }, [data]);

  const visible = maxVisible && !showAll ? sorted.slice(0, maxVisible) : sorted;
  const hasMore = maxVisible != null && sorted.length > maxVisible;

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-orange-500/10 flex items-center justify-center">
            <Home className="w-4 h-4 text-orange-500" />
          </div>
          Host Accountability Flags
          <Badge variant="secondary" className="ml-auto">{data.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {visible.map(({ rawItem, item }, i) => (
          <FlagRow key={i} item={item} rawItem={rawItem} />
        ))}
        {hasMore && !showAll && (
          <Button variant="ghost" size="sm" onClick={() => setShowAll(true)} className="w-full text-primary">
            Show all {sorted.length} flags
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
