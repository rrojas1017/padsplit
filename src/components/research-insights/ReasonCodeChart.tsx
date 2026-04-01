import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowLeft, ArrowRight, ChevronRight, Users, AlertTriangle, RefreshCw } from 'lucide-react';
import { useReasonCodeCounts, ClusterData } from '@/hooks/useReasonCodeCounts';
import { useAddressabilityBreakdown, AddressabilityBucket } from '@/hooks/useAddressabilityBreakdown';
import { ADDRESSABILITY_DESCRIPTIONS } from '@/utils/reason-code-mapping';
import { supabase } from '@/integrations/supabase/client';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { toast } from 'sonner';

interface ReasonCodeChartProps {
  data: any;
  onCodeClick?: (code: string) => void;
  onViewAllMembers?: (cluster: string) => void;
}

interface MemberPreview {
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

// ── Reason Code Drill-Down ──
function ReasonDrillDown({ active, total, onCodeClick, onViewAllMembers, onBack }: {
  active: ClusterData; total: number;
  onCodeClick?: (code: string) => void;
  onViewAllMembers?: (cluster: string) => void;
  onBack: () => void;
}) {
  const [memberPreviews, setMemberPreviews] = useState<MemberPreview[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  useEffect(() => {
    const subReasonNames = active.subReasons
      .filter(s => s.name !== 'Other in this category')
      .map(s => s.name);

    async function fetchMembers() {
      setMembersLoading(true);
      const { data: rows } = await supabase
        .from('booking_transcriptions')
        .select('research_classification, booking_id, bookings!inner(member_name, contact_phone, booking_date)')
        .not('research_classification', 'is', null)
        .eq('research_campaign_type', 'move_out_survey')
        .limit(200);

      if (!rows) { setMembersLoading(false); return; }

      const matching = rows.filter(r => {
        const rc = (r.research_classification as any)?.primary_reason_code;
        return rc && subReasonNames.some(s => s.toLowerCase() === rc.toLowerCase());
      });

      setMemberPreviews(matching.slice(0, 5).map(r => {
        const b = r.bookings as any;
        return {
          memberName: b?.member_name || 'Unknown',
          phone: b?.contact_phone || '—',
          subReason: (r.research_classification as any)?.primary_reason_code || '—',
          date: b?.booking_date || '—',
        };
      }));
      setMembersLoading(false);
    }
    fetchMembers();
  }, [active]);

  const subData = active.subReasons.map((s) => ({
    name: s.name,
    value: s.count,
    pctCluster: active.count > 0 ? Math.round((s.count / active.count) * 100) : 0,
    pctTotal: total > 0 ? Math.round((s.count / total) * 100) : 0,
  }));

  return (
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

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-1/3">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={subData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80}>
                {subData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string) => [`${value} (${total > 0 ? Math.round((value / total) * 100) : 0}%)`, name]}
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sub-Reason</TableHead>
                <TableHead className="text-right">Count</TableHead>
                <TableHead className="text-right">% Cluster</TableHead>
                <TableHead className="text-right">% Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subData.map((s, i) => (
                <TableRow
                  key={i}
                  className={s.name !== 'Other in this category' ? 'cursor-pointer hover:bg-muted/50' : ''}
                  onClick={() => { if (s.name !== 'Other in this category' && onCodeClick) onCodeClick(s.name); }}
                >
                  <TableCell className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                    <span className="text-sm">{s.name}</span>
                  </TableCell>
                  <TableCell className="text-right font-medium">{s.value}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{s.pctCluster}%</TableCell>
                  <TableCell className="text-right text-muted-foreground">{s.pctTotal}%</TableCell>
                </TableRow>
              ))}
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
                  <TableHead>Sub-Reason</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberPreviews.map((m, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{m.memberName}</TableCell>
                    <TableCell className="text-muted-foreground">{m.phone}</TableCell>
                    <TableCell className="text-sm">{m.subReason}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{m.date}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {onViewAllMembers && (
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

  useEffect(() => {
    async function fetchMembers() {
      setMembersLoading(true);
      const { data: rows } = await supabase
        .from('booking_transcriptions')
        .select('research_classification, booking_id, bookings!inner(member_name, contact_phone, booking_date)')
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
              {bucket.reasonBreakdown.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                    <span className="text-sm">{r.cluster}</span>
                  </TableCell>
                  <TableCell className="text-right font-medium">{r.count}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {bucket.count > 0 ? Math.round((r.count / bucket.count) * 100) : 0}%
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {r.avgScore > 0 ? `${r.avgScore} / 10` : '—'}
                  </TableCell>
                </TableRow>
              ))}
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberPreviews.map((m, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{m.memberName}</TableCell>
                    <TableCell className="text-muted-foreground">{m.phone}</TableCell>
                    <TableCell className="text-sm">{m.subReason}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{m.date}</TableCell>
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
