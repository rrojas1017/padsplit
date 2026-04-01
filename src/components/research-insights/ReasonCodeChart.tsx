import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowLeft, ArrowRight, ChevronRight, Users } from 'lucide-react';
import { useReasonCodeCounts, ClusterData } from '@/hooks/useReasonCodeCounts';
import { supabase } from '@/integrations/supabase/client';

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

function CenterLabel({ total }: { total: number }) {
  return (
    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central">
      <tspan x="50%" dy="-0.4em" fontSize={22} fontWeight={700} fill="hsl(var(--foreground))">{total}</tspan>
      <tspan x="50%" dy="1.4em" fontSize={11} fill="hsl(var(--muted-foreground))">cases</tspan>
    </text>
  );
}

export function ReasonCodeChart({ data, onCodeClick, onViewAllMembers }: ReasonCodeChartProps) {
  const { clusters, total, loading } = useReasonCodeCounts();
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);
  const [memberPreviews, setMemberPreviews] = useState<MemberPreview[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // Match report descriptions to clusters
  const descriptions: Record<string, string> = {};
  if (Array.isArray(data)) {
    for (const d of data) {
      const name = d.reason_group || d.code || d.category || '';
      if (name && d.description) descriptions[name] = d.description;
    }
  }

  // Find matching description for a cluster name (fuzzy)
  const getDescription = (clusterName: string) => {
    // Try direct match first
    if (descriptions[clusterName]) return descriptions[clusterName];
    // Try partial matching
    const clusterLower = clusterName.toLowerCase();
    for (const [key, desc] of Object.entries(descriptions)) {
      const keyLower = key.toLowerCase();
      if (clusterLower.includes(keyLower.split('/')[0].trim()) || keyLower.includes(clusterLower.split('/')[0].trim())) {
        return desc;
      }
    }
    return '';
  };

  const active = expandedCluster ? clusters.find(c => c.name === expandedCluster) : null;

  // Fetch member previews when drill-down opens
  useEffect(() => {
    if (!active) { setMemberPreviews([]); return; }

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

      const previews: MemberPreview[] = matching.slice(0, 5).map(r => {
        const b = r.bookings as any;
        return {
          memberName: b?.member_name || 'Unknown',
          phone: b?.contact_phone || '—',
          subReason: (r.research_classification as any)?.primary_reason_code || '—',
          date: b?.booking_date || '—',
        };
      });

      setMemberPreviews(previews);
      setMembersLoading(false);
    }
    fetchMembers();
  }, [active]);

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Reason Code Distribution</CardTitle></CardHeader>
        <CardContent className="flex gap-6 items-center justify-center h-64">
          <Skeleton className="w-48 h-48 rounded-full" />
          <div className="space-y-3 flex-1">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (clusters.length === 0) return null;

  // ── Level 2: Drill-down ──
  if (active) {
    const subData = active.subReasons.map((s, i) => ({
      name: s.name,
      value: s.count,
      pctCluster: active.count > 0 ? Math.round((s.count / active.count) * 100) : 0,
      pctTotal: total > 0 ? Math.round((s.count / total) * 100) : 0,
    }));

    return (
      <Card className="shadow-sm overflow-hidden">
        <CardHeader className="pb-2">
          <Button variant="ghost" size="sm" className="w-fit gap-1.5 -ml-2 mb-1" onClick={() => setExpandedCluster(null)}>
            <ArrowLeft className="w-4 h-4" /> Back to overview
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: active.color }} />
            <CardTitle className="text-base">{active.name}</CardTitle>
            <Badge variant="secondary">{active.count} members</Badge>
            <Badge variant="outline">{active.percentage}%</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Sub-reason pie chart */}
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

            {/* Sub-reason table */}
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
                      onClick={() => {
                        if (s.name !== 'Other in this category' && onCodeClick) onCodeClick(s.name);
                      }}
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
        </CardContent>
      </Card>
    );
  }

  // ── Level 1: Cluster overview ──
  return (
    <Card className="shadow-sm overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Reason Code Distribution</CardTitle>
          <Badge variant="secondary">{clusters.length} clusters · {total} records</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Donut chart */}
          <div className="w-full lg:w-2/5 flex items-center justify-center">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={clusters}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
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

          {/* Cluster cards */}
          <div className="flex-1 space-y-2">
            {clusters.map((c) => (
              <div
                key={c.name}
                className="flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setExpandedCluster(c.name)}
              >
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  {getDescription(c.name) && (
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{getDescription(c.name)}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant="secondary" className="text-xs">{c.count} members</Badge>
                  <Badge variant="outline" className="text-xs">{c.percentage}%</Badge>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
