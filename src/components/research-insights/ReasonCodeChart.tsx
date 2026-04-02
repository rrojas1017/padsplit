import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Treemap } from 'recharts';
import { ArrowLeft, ArrowRight, ChevronRight, Users, AlertTriangle, Eye, Download, Phone, ClipboardList, MoreVertical, Copy, CheckCircle2 } from 'lucide-react';
import { useReasonCodeCounts, ClusterData } from '@/hooks/useReasonCodeCounts';
import { useAddressabilityBreakdown, AddressabilityBucket } from '@/hooks/useAddressabilityBreakdown';
import { ADDRESSABILITY_DESCRIPTIONS, CLUSTER_COLORS } from '@/utils/reason-code-mapping';
import { supabase } from '@/integrations/supabase/client';
import { MemberDetailPanel } from './MemberDetailPanel';
import { ReasonCodeDrillDown } from './ReasonCodeDrillDown';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import {
  DrillDownMember, exportForSurvey, exportCallList,
  copyPhones, generateActionItems, getActionPriority,
} from '@/utils/researchExport';

interface ReasonCodeChartProps {
  data: any;
  onCodeClick?: (code: string) => void;
  onViewAllMembers?: (cluster: string) => void;
}

interface MemberPreview {
  transcriptionId: string;
  memberName: string;
  phone: string;
  subReason: string;
  date: string;
}

const DONUT_COLORS = [
  '#e53e3e', '#dd6b20', '#d69e2e', '#805ad5',
  '#3182ce', '#38a169', '#718096', '#e53e3e',
];

function CenterLabel({ total, label }: { total: number; label?: string }) {
  return (
    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central">
      <tspan x="50%" dy="-0.4em" fontSize={22} fontWeight={700} fill="hsl(var(--foreground))">{total}</tspan>
      <tspan x="50%" dy="1.4em" fontSize={11} fill="hsl(var(--muted-foreground))">{label || 'cases'}</tspan>
    </text>
  );
}

// ── Cluster hue extraction for treemap coloring ──
function getClusterHue(color: string): number {
  const hueMap: Record<string, number> = {
    '#e53e3e': 0, '#dd6b20': 25, '#d69e2e': 45, '#805ad5': 265,
    '#3182ce': 210, '#38a169': 150, '#718096': 220, '#a0aec0': 220,
  };
  return hueMap[color] ?? 220;
}

// ── Custom Treemap Content ──
const CustomTreemapContent = (props: any) => {
  const { x, y, width, height, name, size, fill, root } = props;
  if (!name || !width || !height || width < 30 || height < 25) return null;
  const displayName = String(name || '');
  return (
    <g className="cursor-pointer">
      <rect
        x={x} y={y} width={width} height={height}
        fill={fill}
        stroke="hsl(var(--background))"
        strokeWidth={2}
        rx={4}
        className="hover:opacity-80 transition-opacity"
      />
      {width > 70 && height > 40 && (
        <text x={x + width / 2} y={y + height / 2 - 8} textAnchor="middle" fill="#fff" fontSize={11} fontWeight={600}>
          {displayName.length > 22 ? displayName.substring(0, 20) + '…' : displayName}
        </text>
      )}
      {height > 25 && (
        <text x={x + width / 2} y={y + height / 2 + (width > 70 && height > 40 ? 10 : 4)} textAnchor="middle" fill="#fff" fontSize={13} fontWeight={700}>
          {size}
        </text>
      )}
    </g>
  );
};

// ── Addressability explanation mapping ──
const ADDR_CLUSTER_EXPLANATION: Record<string, Record<string, string>> = {
  'Addressable': {
    'Host Negligence / Property Condition': 'Property issues PadSplit could prevent through host accountability and maintenance enforcement',
    'Payment Friction / Financial Hardship': 'Financial friction reducible through better payment plans or fee transparency',
    'Roommate Conflict / Safety Concern': 'Safety issues preventable through better screening and conflict resolution',
    'Communication Breakdown / Support Dissatisfaction': 'Service gaps fixable through improved support processes and response times',
    'Policy Confusion / Lack of Flexibility': 'Policy friction addressable through clearer documentation and flexible options',
  },
  'Partially Addressable': {
    'Host Negligence / Property Condition': 'Some property issues are within host control but may require external factors',
    'Payment Friction / Financial Hardship': 'Financial hardship partly external but payment flexibility could help',
    'Roommate Conflict / Safety Concern': 'Interpersonal issues partly outside control but mediation could reduce impact',
    'Communication Breakdown / Support Dissatisfaction': 'Some communication gaps are systemic, others are expectation mismatches',
    'Policy Confusion / Lack of Flexibility': 'Policies serve business needs but could be better communicated',
  },
  'Not Addressable': {
    'External Life Event / Positive Move-On': 'Life changes outside PadSplit\'s control — positive outcomes',
    'Host Negligence / Property Condition': 'Rare property issues caused by unforeseeable external events',
    'Payment Friction / Financial Hardship': 'Severe financial hardship beyond what payment flexibility could address',
    'Roommate Conflict / Safety Concern': 'Incidents beyond reasonable prevention measures',
  },
};

function getAddrExplanation(bucket: string, cluster: string): string {
  return ADDR_CLUSTER_EXPLANATION[bucket]?.[cluster] || '';
}

// ── Reason Code Drill-Down ──
function ReasonDrillDown({ active, total, onCodeClick, onViewAllMembers, onBack }: {
  active: ClusterData; total: number;
  onCodeClick?: (code: string) => void;
  onViewAllMembers?: (cluster: string) => void;
  onBack: () => void;
}) {
  const { isAdmin } = useIsAdmin();
  const [allMembers, setAllMembers] = useState<DrillDownMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [selectedSubReasons, setSelectedSubReasons] = useState<Set<string>>(new Set());
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [subReasonDrillDown, setSubReasonDrillDown] = useState<{ name: string; bookingIds: string[] } | null>(null);
  const [actionModal, setActionModal] = useState<{ subReason: string; count: number } | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  useEffect(() => {
    const subReasonNames = active.subReasons
      .filter(s => s.name !== 'Other in this category')
      .map(s => s.name);

    async function fetchMembers() {
      setMembersLoading(true);
      const { data: rows } = await supabase
        .from('booking_transcriptions')
        .select('id, booking_id, research_classification, bookings!inner(member_name, contact_phone, contact_email, booking_date)')
        .not('research_classification', 'is', null)
        .eq('research_campaign_type', 'move_out_survey')
        .limit(500);

      if (!rows) { setMembersLoading(false); return; }

      const matching = rows.filter(r => {
        const cls = r.research_classification as any;
        const detail = (cls?.reason_detail || '').toLowerCase().trim();
        const code = (cls?.primary_reason_code || '').toLowerCase().trim();
        return subReasonNames.some(s => {
          const sl = s.toLowerCase();
          return sl === detail || sl === code;
        });
      });

      setAllMembers(matching.map(r => {
        const b = r.bookings as any;
        const cls = r.research_classification as any;
        return {
          transcriptionId: r.id,
          bookingId: r.booking_id,
          memberName: b?.member_name || 'Unknown',
          phone: b?.contact_phone || '',
          email: b?.contact_email || '',
          reasonCode: cls?.primary_reason_code || '',
          subReason: cls?.reason_detail || cls?.primary_reason_code || '',
          preventabilityScore: cls?.preventability_score ?? cls?.preventability ?? null,
          addressability: cls?.addressability || '',
          keyQuote: cls?.key_quote || cls?.supporting_quote || '',
          caseSummary: cls?.case_brief || cls?.root_cause_summary || '',
          statedReason: cls?.stated_reason_summary || '',
          actualReason: cls?.actual_reason_summary || '',
          statedVsActualMatch: cls?.stated_vs_actual_match || '',
          moveOutDate: b?.booking_date || '',
        };
      }));
      setMembersLoading(false);
    }
    fetchMembers();
  }, [active]);

  const subData = active.subReasons.map((s, i) => ({
    name: s.name,
    value: s.count,
    count: s.count,
    pctCluster: active.count > 0 ? Math.round((s.count / active.count) * 100) : 0,
    pctTotal: total > 0 ? Math.round((s.count / total) * 100) : 0,
  }));

  // Treemap data with HSL colors
  const baseHue = getClusterHue(active.color);
  const treemapData = subData.map((s, i) => ({
    name: s.name,
    size: s.value,
    fill: `hsl(${baseHue}, 70%, ${40 + (i * 6) % 30}%)`,
  }));

  // Filtered members based on selection/treemap click
  const filteredMembers = useMemo(() => {
    if (selectedSubReasons.size > 0) {
      const selLower = new Set([...selectedSubReasons].map(s => s.toLowerCase()));
      return allMembers.filter(m =>
        selLower.has(m.subReason.toLowerCase()) || selLower.has(m.reasonCode.toLowerCase())
      );
    }
    return allMembers;
  }, [allMembers, selectedSubReasons]);

  const pagedMembers = filteredMembers.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filteredMembers.length / PAGE_SIZE);

  // Selection helpers
  const toggleSubReason = (name: string) => {
    const next = new Set(selectedSubReasons);
    next.has(name) ? next.delete(name) : next.add(name);
    setSelectedSubReasons(next);
    setPage(0);
  };

  const selectAll = () => {
    setSelectedSubReasons(new Set(subData.map(s => s.name)));
    setPage(0);
  };

  const clearSelection = () => {
    setSelectedSubReasons(new Set());
    setSelectedMembers(new Set());
    setPage(0);
  };

  const toggleMember = (id: string) => {
    const next = new Set(selectedMembers);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedMembers(next);
  };

  // Export helpers
  const getExportMembers = () => {
    if (selectedMembers.size > 0) {
      return filteredMembers.filter(m => selectedMembers.has(m.transcriptionId));
    }
    return filteredMembers;
  };

  const makeFilename = (type: string, sub?: string) => {
    const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
    const date = new Date().toISOString().split('T')[0];
    return `padsplit-${slug(active.name)}${sub ? '-' + slug(sub) : ''}-${type}-${date}.csv`;
  };

  const handleExportSurvey = (members?: DrillDownMember[], sub?: string) => {
    exportForSurvey(members || getExportMembers(), makeFilename('survey', sub));
  };

  const handleExportCallList = (members?: DrillDownMember[], sub?: string) => {
    exportCallList(members || getExportMembers(), makeFilename('call-list', sub));
  };

  const handleCopyPhones = (members?: DrillDownMember[]) => {
    copyPhones(members || getExportMembers());
  };

  const getMembersForSubReason = (subName: string) => {
    const sl = subName.toLowerCase();
    return allMembers.filter(m =>
      m.subReason.toLowerCase() === sl || m.reasonCode.toLowerCase() === sl
    );
  };

  // Action items
  const currentActions = actionModal
    ? generateActionItems(actionModal.subReason, actionModal.count, active.name)
    : [];
  const currentPriority = actionModal
    ? getActionPriority(active.name, actionModal.count)
    : null;

  const totalSelected = selectedSubReasons.size > 0 || selectedMembers.size > 0;

  return (
    <>
    <div className="space-y-5">
      <Button variant="ghost" size="sm" className="w-fit gap-1.5 -ml-2" onClick={onBack}>
        <ArrowLeft className="w-4 h-4" /> Back to overview
      </Button>

      <div className="flex items-center gap-3">
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: active.color }} />
        <h3 className="text-base font-semibold">{active.name}</h3>
        <Badge variant="secondary">{active.count} members</Badge>
        <Badge variant="outline">{active.percentage}%</Badge>
      </div>

      {/* Treemap */}
      <div className="border rounded-lg p-3">
        <h4 className="text-sm font-medium mb-2">Sub-Reason Distribution</h4>
        <ResponsiveContainer width="100%" height={220}>
          <Treemap
            data={treemapData}
            dataKey="size"
            aspectRatio={4 / 3}
            content={<CustomTreemapContent />}
            onClick={(node: any) => {
              if (node?.name) {
                const ids = getMembersForSubReason(node.name).map(m => m.bookingId);
                setSubReasonDrillDown({ name: node.name, bookingIds: ids });
              }
            }}
          >
            <Tooltip
              formatter={(value: number, name: string) => [
                `${value} members (${active.count > 0 ? Math.round((value / active.count) * 100) : 0}% of cluster)`,
                name,
              ]}
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
            />
          </Treemap>
        </ResponsiveContainer>
      </div>

      {/* Sub-reason breakdown table */}
      <div className="overflow-auto">
        <div className="flex items-center gap-2 mb-2">
          <Button variant="outline" size="sm" className="text-xs h-7" onClick={selectAll}>Select All</Button>
          {selectedSubReasons.size > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={clearSelection}>Clear</Button>
          )}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Sub-Reason</TableHead>
              <TableHead className="text-right">Count</TableHead>
              <TableHead className="text-right">% Cluster</TableHead>
              <TableHead className="text-right">% Total</TableHead>
              {isAdmin && <TableHead className="w-16 text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {subData.map((s, i) => (
              <TableRow
                key={i}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => {
                  const ids = getMembersForSubReason(s.name).map(m => m.bookingId);
                  setSubReasonDrillDown({ name: s.name, bookingIds: ids });
                }}
              >
                <TableCell onClick={e => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedSubReasons.has(s.name)}
                    onCheckedChange={() => toggleSubReason(s.name)}
                  />
                </TableCell>
                <TableCell className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: `hsl(${baseHue}, 70%, ${40 + (i * 6) % 30}%)` }} />
                  <span className="text-sm font-medium">{s.name}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                </TableCell>
                <TableCell className="text-right font-medium">{s.value}</TableCell>
                <TableCell className="text-right text-muted-foreground">{s.pctCluster}%</TableCell>
                <TableCell className="text-right text-muted-foreground">{s.pctTotal}%</TableCell>
                {isAdmin && (
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <MoreVertical className="w-3.5 h-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleExportSurvey(getMembersForSubReason(s.name), s.name)}>
                          <Download className="w-3.5 h-3.5 mr-2" /> Export for Survey
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExportCallList(getMembersForSubReason(s.name), s.name)}>
                          <Phone className="w-3.5 h-3.5 mr-2" /> Export Call List
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setActionModal({ subReason: s.name, count: s.value })}>
                          <ClipboardList className="w-3.5 h-3.5 mr-2" /> Generate Action Items
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleCopyPhones(getMembersForSubReason(s.name))}>
                          <Copy className="w-3.5 h-3.5 mr-2" /> Copy Member Phones
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Member preview */}
      <div className="border-t pt-4">
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          {selectedSubReasons.size > 0
            ? `Members (${filteredMembers.length})`
            : `Member Preview (${allMembers.length})`}
        </h4>
        {membersLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
        ) : pagedMembers.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  {isAdmin && <TableHead className="w-10"></TableHead>}
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Sub-Reason</TableHead>
                  <TableHead className="text-center w-20">Score</TableHead>
                  <TableHead>Key Quote</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedMembers.map((m) => {
                  const scoreColor = m.preventabilityScore != null
                    ? m.preventabilityScore >= 7 ? 'text-destructive bg-destructive/10'
                    : m.preventabilityScore >= 4 ? 'text-amber-500 bg-amber-500/10'
                    : 'text-green-600 bg-green-600/10'
                    : '';
                  return (
                    <TableRow
                      key={m.transcriptionId}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setDetailId(m.transcriptionId)}
                    >
                      {isAdmin && (
                        <TableCell onClick={e => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedMembers.has(m.transcriptionId)}
                            onCheckedChange={() => toggleMember(m.transcriptionId)}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium">{m.memberName}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{m.phone || '—'}</TableCell>
                      <TableCell className="text-sm">{m.subReason}</TableCell>
                      <TableCell className="text-center">
                        {m.preventabilityScore != null ? (
                          <span className={`inline-flex items-center justify-center w-8 h-6 rounded text-xs font-bold ${scoreColor}`}>
                            {m.preventabilityScore}
                          </span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <p className="text-xs text-muted-foreground italic line-clamp-1 max-w-[180px]">
                          {m.keyQuote || '—'}
                        </p>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{m.moveOutDate}</TableCell>
                      <TableCell>
                        <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-muted-foreground">
                  Page {page + 1} of {totalPages} ({filteredMembers.length} members)
                </span>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
                </div>
              </div>
            )}
            {selectedSubReasons.size === 0 && onViewAllMembers && (
              <Button variant="link" size="sm" className="mt-2 gap-1" onClick={() => onViewAllMembers(active.name)}>
                View all {active.count} members <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No member records found for this cluster.</p>
        )}
      </div>
    </div>

    {/* Floating action bar */}
    {isAdmin && totalSelected && (
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg p-4 z-50 flex items-center justify-between">
        <span className="text-sm font-medium flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-primary" />
          {selectedSubReasons.size > 0
            ? `${selectedSubReasons.size} sub-reasons selected (${filteredMembers.length} members)`
            : `${selectedMembers.size} members selected`}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExportSurvey()} className="gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" /> Export for Survey
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExportCallList()} className="gap-1.5 text-xs">
            <Phone className="w-3.5 h-3.5" /> Export Call List
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            const firstSub = [...selectedSubReasons][0] || 'Selected';
            const count = filteredMembers.length;
            setActionModal({ subReason: firstSub, count });
          }} className="gap-1.5 text-xs">
            <ClipboardList className="w-3.5 h-3.5" /> Generate Action Items
          </Button>
          <Button variant="ghost" size="sm" onClick={clearSelection} className="text-xs">Clear</Button>
        </div>
      </div>
    )}

    {/* Action Items Modal */}
    <Dialog open={!!actionModal} onOpenChange={o => { if (!o) setActionModal(null); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="w-4 h-4" />
            Action Items: {actionModal?.subReason}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {currentPriority && (
            <Badge variant={currentPriority.level === 'P0' ? 'destructive' : 'secondary'}>
              {currentPriority.label}
            </Badge>
          )}
          <p className="text-sm text-muted-foreground">{actionModal?.count} members affected</p>
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Recommended Actions:</h4>
            <ol className="list-decimal list-inside space-y-1.5 text-sm">
              {currentActions.map((a, i) => <li key={i}>{a}</li>)}
            </ol>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
              const text = `Action Items: ${actionModal?.subReason}\nPriority: ${currentPriority?.label}\n${actionModal?.count} members affected\n\n${currentActions.map((a, i) => `${i + 1}. ${a}`).join('\n')}`;
              navigator.clipboard.writeText(text);
              import('@/hooks/use-toast').then(m => m.toast({ title: 'Copied to clipboard' }));
            }}>
              <Copy className="w-3.5 h-3.5" /> Copy to Clipboard
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <MemberDetailPanel
      open={!!detailId}
      onOpenChange={(o) => { if (!o) setDetailId(null); }}
      transcriptionId={detailId}
    />

    {subReasonDrillDown && (
      <ReasonCodeDrillDown
        open={!!subReasonDrillDown}
        onOpenChange={(o) => { if (!o) setSubReasonDrillDown(null); }}
        reasonCode={subReasonDrillDown.name}
        reasonColor={active.color}
        reasonCount={subReasonDrillDown.bookingIds.length}
        bookingIds={subReasonDrillDown.bookingIds}
      />
    )}
    </>
  );
}

// ── Addressability Drill-Down ──
function AddressabilityDrillDown({ bucket, total, onViewAllMembers, onBack }: {
  bucket: AddressabilityBucket; total: number;
  onViewAllMembers?: (cluster: string) => void;
  onBack: () => void;
}) {
  const [memberPreviews, setMemberPreviews] = useState<MemberPreview[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMembers() {
      setMembersLoading(true);
      const { data: rows } = await supabase
        .from('booking_transcriptions')
        .select('id, research_classification, booking_id, bookings!inner(member_name, contact_phone, booking_date)')
        .not('research_classification', 'is', null)
        .eq('research_campaign_type', 'move_out_survey')
        .limit(200);

      if (!rows) { setMembersLoading(false); return; }

      const { normalizeAddressability } = await import('@/utils/reason-code-mapping');
      const matching = rows.filter(r => {
        const cls = r.research_classification as any;
        return cls?.addressability && normalizeAddressability(cls.addressability) === bucket.name;
      });

      setMemberPreviews(matching.slice(0, 5).map(r => {
        const b = r.bookings as any;
        return {
          transcriptionId: r.id,
          memberName: b?.member_name || 'Unknown',
          phone: b?.contact_phone || '—',
          subReason: (r.research_classification as any)?.primary_reason_code || '—',
          date: b?.booking_date || '—',
        };
      }));
      setMembersLoading(false);
    }
    fetchMembers();
  }, [bucket]);

  const pieData = bucket.reasonBreakdown.map(r => ({
    name: r.cluster,
    value: r.count,
    color: r.color,
  }));

  return (
    <>
    <div className="space-y-5">
      <Button variant="ghost" size="sm" className="w-fit gap-1.5 -ml-2" onClick={onBack}>
        <ArrowLeft className="w-4 h-4" /> Back to overview
      </Button>
      <div className="flex items-center gap-3">
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: bucket.color }} />
        <h3 className="text-base font-semibold">{bucket.name}</h3>
        <Badge variant="secondary">{bucket.count} members</Badge>
        <Badge variant="outline">{bucket.percentage}%</Badge>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-1/3">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80}>
                {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string) => [`${value} members`, name]}
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reason Cluster</TableHead>
                <TableHead className="text-right">Count</TableHead>
                <TableHead className="text-right">% of Bucket</TableHead>
                <TableHead className="text-right">Avg Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bucket.reasonBreakdown.map((r, i) => {
                const explanation = getAddrExplanation(bucket.name, r.cluster);
                return (
                  <React.Fragment key={i}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setExpandedCluster(expandedCluster === r.cluster ? null : r.cluster)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${expandedCluster === r.cluster ? 'rotate-90' : ''}`} />
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                          <div>
                            <span className="text-sm font-medium">{r.cluster}</span>
                            {explanation && (
                              <p className="text-[10px] italic text-muted-foreground mt-0.5">{explanation}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">{r.count}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {bucket.count > 0 ? Math.round((r.count / bucket.count) * 100) : 0}%
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {r.avgScore > 0 ? `${r.avgScore} / 10` : '—'}
                      </TableCell>
                    </TableRow>
                    {expandedCluster === r.cluster && r.subReasons && r.subReasons.length > 0 && (
                      r.subReasons.map((sub, si) => (
                        <TableRow key={`sub-${si}`} className="bg-muted/30">
                          <TableCell className="pl-12 text-sm text-muted-foreground">{sub.name}</TableCell>
                          <TableCell className="text-right text-sm">{sub.count}</TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {r.count > 0 ? Math.round((sub.count / r.count) * 100) : 0}%
                          </TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      ))
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Member preview */}
      <div className="border-t pt-4">
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" /> Member Preview
        </h4>
        {membersLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
        ) : memberPreviews.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberPreviews.map((m, i) => (
                  <TableRow
                    key={i}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setDetailId(m.transcriptionId)}
                  >
                    <TableCell className="font-medium">{m.memberName}</TableCell>
                    <TableCell className="text-muted-foreground">{m.phone}</TableCell>
                    <TableCell className="text-sm">{m.subReason}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{m.date}</TableCell>
                    <TableCell>
                      <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {onViewAllMembers && (
              <Button variant="link" size="sm" className="mt-2 gap-1" onClick={() => onViewAllMembers(bucket.name)}>
                View all {bucket.count} members <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No member records found.</p>
        )}
      </div>
    </div>

    <MemberDetailPanel
      open={!!detailId}
      onOpenChange={(o) => { if (!o) setDetailId(null); }}
      transcriptionId={detailId}
    />
    </>
  );
}

// ── Main Component ──
export function ReasonCodeChart({ data, onCodeClick, onViewAllMembers }: ReasonCodeChartProps) {
  const { clusters, total, loading } = useReasonCodeCounts();
  const { buckets, total: addrTotal, loading: addrLoading } = useAddressabilityBreakdown();
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);
  const [expandedBucket, setExpandedBucket] = useState<string | null>(null);

  // "Other" % warning
  const otherCluster = clusters.find(c => c.name === 'Other / Unspecified');
  const otherPct = total > 0 && otherCluster ? Math.round((otherCluster.count / total) * 100) : 0;

  // Match report descriptions to clusters
  const descriptions: Record<string, string> = {};
  if (Array.isArray(data)) {
    for (const d of data) {
      const name = d.reason_group || d.code || d.category || '';
      if (name && d.description) descriptions[name] = d.description;
    }
  }

  const getDescription = (clusterName: string) => {
    if (descriptions[clusterName]) return descriptions[clusterName];
    const clusterLower = clusterName.toLowerCase();
    for (const [key, desc] of Object.entries(descriptions)) {
      const keyLower = key.toLowerCase();
      if (clusterLower.includes(keyLower.split('/')[0].trim()) || keyLower.includes(clusterLower.split('/')[0].trim())) {
        return desc;
      }
    }
    return '';
  };

  const activeCluster = expandedCluster ? clusters.find(c => c.name === expandedCluster) : null;
  const activeBucket = expandedBucket ? buckets.find(b => b.name === expandedBucket) : null;

  const isLoading = loading || addrLoading;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map(i => (
          <Card key={i}>
            <CardHeader><Skeleton className="h-5 w-48" /></CardHeader>
            <CardContent className="flex gap-6 items-center justify-center h-64">
              <Skeleton className="w-48 h-48 rounded-full" />
              <div className="space-y-3 flex-1">
                {[1,2,3].map(j => <Skeleton key={j} className="h-12 w-full" />)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // ── Drill-down mode: full width ──
  if (activeCluster) {
    return (
      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-6">
          <ReasonDrillDown
            active={activeCluster}
            total={total}
            onCodeClick={onCodeClick}
            onViewAllMembers={onViewAllMembers}
            onBack={() => setExpandedCluster(null)}
          />
        </CardContent>
      </Card>
    );
  }

  if (activeBucket) {
    return (
      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-6">
          <AddressabilityDrillDown
            bucket={activeBucket}
            total={addrTotal}
            onViewAllMembers={onViewAllMembers}
            onBack={() => setExpandedBucket(null)}
          />
        </CardContent>
      </Card>
    );
  }

  // ── Level 1: Side-by-side overview ──
  return (
    <div className="space-y-4">
      {otherPct > 10 && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <AlertDescription className="text-sm">
            <strong>{otherPct}%</strong> of records could not be classified — classification prompts may need review.
          </AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Reason Code Distribution */}
      {clusters.length > 0 && (
        <Card className="shadow-sm overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Reason Code Distribution</CardTitle>
              <Badge variant="secondary" className="text-xs">{total} records</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={clusters}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                    className="cursor-pointer"
                    onClick={(_: any, idx: number) => setExpandedCluster(clusters[idx]?.name || null)}
                  >
                    {clusters.map((c, i) => <Cell key={i} fill={c.color} />)}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [`${value} (${total > 0 ? Math.round((value / total) * 100) : 0}%)`, name]}
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
                  />
                  <CenterLabel total={total} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-1.5">
              {clusters.map((c) => (
                <div
                  key={c.name}
                  className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedCluster(c.name)}
                >
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{c.name}</p>
                    {getDescription(c.name) && (
                      <p className="text-[10px] text-muted-foreground line-clamp-1">{getDescription(c.name)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-xs font-medium">{c.count}</span>
                    <span className="text-[10px] text-muted-foreground">{c.percentage}%</span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Addressability Breakdown */}
      {buckets.length > 0 && (
        <Card className="shadow-sm overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Addressability Breakdown</CardTitle>
              <Badge variant="secondary" className="text-xs">{addrTotal} records</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={buckets}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                    className="cursor-pointer"
                    onClick={(_: any, idx: number) => setExpandedBucket(buckets[idx]?.name || null)}
                  >
                    {buckets.map((b, i) => <Cell key={i} fill={b.color} />)}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [`${value} (${addrTotal > 0 ? Math.round((value / addrTotal) * 100) : 0}%)`, name]}
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
                  />
                  <CenterLabel total={addrTotal} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-1.5">
              {buckets.map((b) => (
                <div
                  key={b.name}
                  className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedBucket(b.name)}
                >
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: b.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{b.name}</p>
                    <p className="text-[10px] text-muted-foreground line-clamp-1">
                      {ADDRESSABILITY_DESCRIPTIONS[b.name] || ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-xs font-medium">{b.count}</span>
                    <span className="text-[10px] text-muted-foreground">{b.percentage}%</span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
    </div>
  );
}
