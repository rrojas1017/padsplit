import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Lightbulb, Download, Quote, Users, ShieldCheck, CheckCircle2, ExternalLink } from 'lucide-react';
import { useState, useEffect } from 'react';
import { PriorityBadge } from './PriorityBadge';
import { exportByKeywords } from '@/utils/researchExport';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ReasonCodeDrillDown } from './ReasonCodeDrillDown';
import type { ExportFilter } from '@/hooks/useExportMembers';

interface IssueCluster {
  cluster_name: string;
  description?: string;
  priority?: string;
  recommended_action?: string | string[] | { action: string; owner?: string; priority?: string };
  recommended_actions?: string[];
  supporting_quotes?: string[];
  cluster_description?: string;
  frequency?: number;
  case_count?: number;
  representative_quotes?: string[];
  key_quotes?: string[];
  systemic_root_cause?: string;
  root_cause?: string;
  preventable_pct?: number;
  addressable_pct?: number;
  booking_ids?: string[];
  reason_codes_included?: string[];
}

interface IssueClustersProps {
  data: IssueCluster[];
  maxVisible?: number;
  onExportModal?: (filter: ExportFilter, title: string, filename: string) => void;
}

function getPriorityBorderColor(priority?: string): string {
  if (!priority) return 'hsl(var(--muted-foreground) / 0.3)';
  const p = priority.toUpperCase();
  if (p.includes('P0')) return 'hsl(var(--destructive))';
  if (p.includes('P1')) return 'hsl(25, 95%, 53%)'; // orange
  if (p.includes('P2')) return 'hsl(45, 93%, 47%)'; // yellow/amber
  if (p.includes('P3')) return 'hsl(var(--muted-foreground) / 0.3)';
  return 'hsl(var(--muted-foreground) / 0.3)';
}

interface MemberPreview {
  bookingId: string;
  memberName: string;
  phone: string;
  reasonCode: string;
}

export function IssueClustersPanel({ data, maxVisible, onExportModal }: IssueClustersProps) {
  const [showAll, setShowAll] = useState(false);

  if (!data?.length) return null;

  const sorted = [...data].sort((a, b) => {
    const pa = a.priority?.toUpperCase() || 'P9';
    const pb = b.priority?.toUpperCase() || 'P9';
    return pa.localeCompare(pb);
  });

  const capped = maxVisible && !showAll ? sorted.slice(0, maxVisible) : sorted;
  const hasMore = maxVisible ? sorted.length > maxVisible : false;

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Issue Clusters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {capped.map((cluster, i) => (
          <ClusterCard key={i} cluster={cluster} />
        ))}
        {hasMore && (
          <Button variant="ghost" size="sm" onClick={() => setShowAll(!showAll)} className="w-full text-xs">
            {showAll ? 'Show fewer' : `Show all ${sorted.length} clusters`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function ClusterCard({ cluster }: { cluster: IssueCluster }) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<MemberPreview[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [drillDownOpen, setDrillDownOpen] = useState(false);

  const desc = cluster.description || cluster.cluster_description;
  const quotes = (cluster.supporting_quotes || cluster.representative_quotes || cluster.key_quotes || []).slice(0, 3);
  const rootCause = cluster.systemic_root_cause || cluster.root_cause;

  // Parse actions — can be string, string[], or object
  const actions: string[] = [];
  if (cluster.recommended_actions?.length) {
    actions.push(...cluster.recommended_actions);
  } else if (Array.isArray(cluster.recommended_action)) {
    actions.push(...cluster.recommended_action);
  } else if (typeof cluster.recommended_action === 'string') {
    // Split on numbered list patterns or semicolons
    const parts = cluster.recommended_action.split(/(?:\d+\.\s|;\s*)/);
    actions.push(...parts.filter(Boolean).map(s => s.trim()));
  } else if (cluster.recommended_action?.action) {
    actions.push(cluster.recommended_action.action);
  }

  const actionPriority = cluster.priority || (typeof cluster.recommended_action === 'object' && !Array.isArray(cluster.recommended_action) ? cluster.recommended_action?.priority : undefined);
  const freq = cluster.frequency ?? cluster.case_count;
  const borderColor = getPriorityBorderColor(actionPriority);
  const preventablePct = cluster.preventable_pct ?? cluster.addressable_pct;

  const clusterKeywords = cluster.cluster_name.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3);

  // Fetch member previews when expanded
  useEffect(() => {
    if (!open || members.length > 0 || membersLoading) return;
    setMembersLoading(true);

    const fetchMembers = async () => {
      try {
        if (cluster.booking_ids?.length) {
          const { data } = await supabase
            .from('booking_transcriptions')
            .select('booking_id, research_classification, bookings!inner(member_name, contact_phone)')
            .in('booking_id', cluster.booking_ids.slice(0, 5));
          if (data) setMembers(data.map(mapMember));
          setMembersLoading(false);
          return;
        }

        // Keyword fallback
        const { data } = await supabase
          .from('booking_transcriptions')
          .select('booking_id, research_classification, bookings!inner(member_name, contact_phone, record_type, has_valid_conversation)')
          .eq('research_processing_status', 'completed')
          .not('research_classification', 'is', null)
          .limit(200);

        if (data) {
          const matched = data.filter((row: any) => {
            const b = row.bookings as any;
            if (b?.record_type !== 'research' || !b?.has_valid_conversation) return false;
            const cls = row.research_classification as any;
            if (!cls) return false;
            const text = [cls.primary_reason_code, cls.reason_code, cls.root_cause_summary, cls.root_cause, ...(cls.sub_reasons || [])].filter(Boolean).join(' ').toLowerCase();
            return clusterKeywords.some(kw => text.includes(kw));
          }).slice(0, 5);
          setMembers(matched.map(mapMember));
        }
      } catch (err) {
        console.error('Error fetching member previews:', err);
      } finally {
        setMembersLoading(false);
      }
    };
    fetchMembers();
  }, [open]);

  function mapMember(row: any): MemberPreview {
    const b = row.bookings as any;
    const cls = row.research_classification as any;
    return {
      bookingId: row.booking_id,
      memberName: b?.member_name || 'Unknown',
      phone: b?.contact_phone || '',
      reasonCode: cls?.primary_reason_code || cls?.reason_code || '',
    };
  }

  return (
    <>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="w-full">
          <div
            className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left"
            style={{ borderLeftWidth: '4px', borderLeftColor: borderColor }}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-medium text-foreground text-sm">{cluster.cluster_name}</p>
                <PriorityBadge priority={actionPriority} />
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {freq != null && (
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    Affects <span className="font-semibold text-foreground">{freq}</span> members
                  </span>
                )}
                {preventablePct != null && (
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span className="font-semibold text-foreground">{Math.round(preventablePct)}%</span> preventable
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Export members in this cluster"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onExportModal) {
                    onExportModal(
                      { type: 'keywords', keywords: clusterKeywords },
                      `Cluster: ${cluster.cluster_name}`,
                      `cluster_${cluster.cluster_name.replace(/\s+/g, '_')}.csv`
                    );
                  }
                }}
              >
                <Download className="w-3.5 h-3.5" />
              </Button>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="ml-1 mr-0 mt-2 mb-1 p-4 rounded-lg bg-muted/20 border border-border/50 space-y-4" style={{ borderLeftWidth: '4px', borderLeftColor: borderColor }}>
            {/* Root Cause */}
            {(rootCause || desc) && (
              <div className="bg-card rounded-xl p-3 border border-border">
                <p className="text-xs font-semibold text-foreground mb-1 uppercase tracking-wide">Root Cause</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{rootCause || desc}</p>
              </div>
            )}

            {/* Top quotes */}
            {quotes.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Member Quotes</p>
                {quotes.map((q, i) => (
                  <div key={i} className="bg-accent/40 border border-accent rounded-lg p-3 flex items-start gap-2">
                    <Quote className="w-3.5 h-3.5 text-accent-foreground mt-0.5 flex-shrink-0" />
                    <p className="text-sm italic text-muted-foreground leading-relaxed">&ldquo;{q}&rdquo;</p>
                  </div>
                ))}
              </div>
            )}

            {/* Recommended actions as checklist */}
            {actions.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wide flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-primary" />
                  Recommended Actions
                </p>
                <div className="space-y-1.5">
                  {actions.map((action, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-foreground">{action}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Affected members preview */}
            <div>
              <p className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wide">Affected Members</p>
              {membersLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-8 bg-muted/40 rounded animate-pulse" />
                  ))}
                </div>
              ) : members.length > 0 ? (
                <div className="space-y-1">
                  {members.map((m) => (
                    <div key={m.bookingId} className="flex items-center justify-between p-2 rounded-md bg-card border border-border text-sm">
                      <span className="font-medium text-foreground">{m.memberName}</span>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {m.phone && <span>{m.phone}</span>}
                        {m.reasonCode && <Badge variant="outline" className="text-[10px]">{m.reasonCode}</Badge>}
                      </div>
                    </div>
                  ))}
                  {freq != null && freq > 5 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs gap-1 text-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDrillDownOpen(true);
                      }}
                    >
                      <ExternalLink className="w-3 h-3" />
                      View all {freq} members
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No member data available for preview.</p>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <ReasonCodeDrillDown
        open={drillDownOpen}
        onOpenChange={setDrillDownOpen}
        reasonCode={cluster.cluster_name}
        reasonColor={borderColor}
        reasonCount={freq}
        bookingIds={cluster.booking_ids}
        includedReasonCodes={cluster.reason_codes_included}
        categoryDescription={desc}
      />
    </>
  );
}
