import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, Search, ChevronLeft, ChevronRight, Users, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { normalizeAddressability } from '@/utils/reason-code-mapping';
import { fetchAllPages } from '@/utils/fetchAllPages';
import { MemberDetailPanel } from './MemberDetailPanel';

interface MemberRecord {
  id: string;
  bookingId: string;
  memberName: string;
  phone: string;
  primaryReasonCode: string;
  preventabilityScore: number | null;
  addressability: string;
  normalizedAddressability: string;
  callDate: string;
  flagged: boolean;
  audited: boolean;
  caseBrief: string;
}

const PAGE_SIZE = 25;

function scoreColor(score: number | null) {
  if (score == null) return '';
  if (score >= 7) return 'text-red-600 bg-red-100';
  if (score >= 4) return 'text-amber-600 bg-amber-100';
  return 'text-emerald-600 bg-emerald-100';
}

export function MemberDataTab({ isAdmin }: { isAdmin: boolean }) {
  const [records, setRecords] = useState<MemberRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [scoreFilter, setScoreFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [addressabilityFilter, setAddressabilityFilter] = useState('all');
  const [sortField, setSortField] = useState<keyof MemberRecord>('callDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      // Try join first, fall back to standalone query if FK isn't resolved
      let data: any[] = [];

      try {
        data = await fetchAllPages((from, to) =>
          supabase
            .from('booking_transcriptions')
            .select('id, booking_id, research_extraction, research_classification, research_human_review, research_audit, research_campaign_type, created_at, bookings(member_name, contact_phone)')
            .not('research_extraction', 'is', null)
            .eq('research_campaign_type', 'move_out_survey')
            .order('created_at', { ascending: false })
            .range(from, to)
        );
      } catch {
        data = [];
      }

      if (data.length === 0) {
        // Fallback: query without join
        data = await fetchAllPages((from, to) =>
          supabase
            .from('booking_transcriptions')
            .select('id, booking_id, research_extraction, research_classification, research_human_review, research_audit, research_campaign_type, created_at')
            .not('research_extraction', 'is', null)
            .eq('research_campaign_type', 'move_out_survey')
            .order('created_at', { ascending: false })
            .range(from, to)
        );
      }

      const mapped: MemberRecord[] = (data || []).map((r: any) => {
        const b = r.bookings as any;
        const cls = r.research_classification as any;
        const ext = r.research_extraction as any;
        const rawName = b?.member_name || ext?.member_name || 'Unknown';
        return {
          id: r.id,
          bookingId: r.booking_id,
          memberName: rawName.startsWith('API Submission - ') ? rawName.replace('API Submission - ', '') : rawName,
          phone: b?.contact_phone || ext?.phone_number || '',
          primaryReasonCode: cls?.primary_reason_code || '',
          preventabilityScore: cls?.preventability_score ?? null,
          addressability: cls?.addressability || '',
          normalizedAddressability: normalizeAddressability(cls?.addressability || ''),
          callDate: r.created_at || '',
          flagged: !!r.research_human_review,
          audited: !!r.research_audit,
          caseBrief: cls?.case_brief || '',
        };
      });

      setRecords(mapped);
    } catch (err) {
      console.error('Failed to fetch member data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const reasonCodes = useMemo(() => {
    const codes = new Set<string>();
    records.forEach(r => { if (r.primaryReasonCode) codes.add(r.primaryReasonCode); });
    return Array.from(codes).sort();
  }, [records]);

  const filtered = useMemo(() => {
    let result = records;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        r.memberName.toLowerCase().includes(q) || r.phone.includes(q)
      );
    }
    if (reasonFilter !== 'all') result = result.filter(r => r.primaryReasonCode === reasonFilter);
    if (scoreFilter === 'high') result = result.filter(r => r.preventabilityScore != null && r.preventabilityScore >= 7);
    else if (scoreFilter === 'medium') result = result.filter(r => r.preventabilityScore != null && r.preventabilityScore >= 4 && r.preventabilityScore < 7);
    else if (scoreFilter === 'low') result = result.filter(r => r.preventabilityScore != null && r.preventabilityScore < 4);
    if (statusFilter === 'flagged') result = result.filter(r => r.flagged);
    else if (statusFilter === 'audited') result = result.filter(r => r.audited);
    else if (statusFilter === 'not_audited') result = result.filter(r => !r.audited);
    if (addressabilityFilter !== 'all') result = result.filter(r => r.normalizedAddressability === addressabilityFilter);

    result.sort((a, b) => {
      const aVal = a[sortField] ?? '';
      const bVal = b[sortField] ?? '';
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [records, search, reasonFilter, scoreFilter, statusFilter, addressabilityFilter, sortField, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => { setPage(0); }, [search, reasonFilter, scoreFilter, statusFilter, addressabilityFilter]);

  const allSelected = pageData.length > 0 && pageData.every(r => selected.has(r.id));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allSelected) pageData.forEach(r => next.delete(r.id));
    else pageData.forEach(r => next.add(r.id));
    setSelected(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const handleSort = (field: keyof MemberRecord) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const handleExport = useCallback(() => {
    const toExport = selected.size > 0 ? filtered.filter(r => selected.has(r.id)) : filtered;
    const dateStr = format(new Date(), 'yyyy-MM-dd');
    const header = 'Member Name,Phone,Reason Code,Score,Addressability,Case Brief,Date';
    const rows = toExport.map(r =>
      [r.memberName, r.phone, r.primaryReasonCode, r.preventabilityScore ?? '', r.normalizedAddressability, `"${(r.caseBrief || '').replace(/"/g, '""')}"`, r.callDate ? format(new Date(r.callDate), 'MMM d, yyyy') : ''].join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PadSplit-Members-${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered, selected]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  return (
    <>
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Member Data
              <Badge variant="secondary" className="text-xs">{filtered.length}</Badge>
            </CardTitle>
            <Button size="sm" onClick={handleExport} variant="outline" className="gap-1.5">
              <Download className="w-4 h-4" />
              {selected.size > 0 ? `Export ${selected.size}` : 'Export Members'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search name or phone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={reasonFilter} onValueChange={setReasonFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Reasons" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reasons</SelectItem>
                {reasonCodes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={scoreFilter} onValueChange={setScoreFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="All Scores" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Scores</SelectItem>
                <SelectItem value="high">High (7-10)</SelectItem>
                <SelectItem value="medium">Medium (4-6)</SelectItem>
                <SelectItem value="low">Low (1-3)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="flagged">Flagged Only</SelectItem>
                <SelectItem value="audited">Audited</SelectItem>
                <SelectItem value="not_audited">Not Yet Audited</SelectItem>
              </SelectContent>
            </Select>
            <Select value={addressabilityFilter} onValueChange={setAddressabilityFilter}>
              <SelectTrigger className="w-[170px]"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Addressable">Addressable</SelectItem>
                <SelectItem value="Partially Addressable">Partially Addressable</SelectItem>
                <SelectItem value="Not Addressable">Not Addressable</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="border border-border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"><Checkbox checked={allSelected} onCheckedChange={toggleAll} /></TableHead>
                  <TableHead className="cursor-pointer text-xs" onClick={() => handleSort('memberName')}>Member Name {sortField === 'memberName' && (sortDir === 'asc' ? '↑' : '↓')}</TableHead>
                  <TableHead className="text-xs">Phone</TableHead>
                  <TableHead className="cursor-pointer text-xs" onClick={() => handleSort('primaryReasonCode')}>Reason Code {sortField === 'primaryReasonCode' && (sortDir === 'asc' ? '↑' : '↓')}</TableHead>
                  <TableHead className="cursor-pointer text-xs w-16 text-center" onClick={() => handleSort('preventabilityScore')}>Score {sortField === 'preventabilityScore' && (sortDir === 'asc' ? '↑' : '↓')}</TableHead>
                  <TableHead className="text-xs hidden lg:table-cell">Addressability</TableHead>
                  <TableHead className="cursor-pointer text-xs w-24" onClick={() => handleSort('callDate')}>Date {sortField === 'callDate' && (sortDir === 'asc' ? '↑' : '↓')}</TableHead>
                  <TableHead className="text-xs w-24">Status</TableHead>
                  <TableHead className="text-xs w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageData.map(r => (
                  <TableRow
                    key={r.id}
                    className={`cursor-pointer hover:bg-muted/50 transition-colors ${selected.has(r.id) ? 'bg-primary/5' : ''}`}
                    onClick={() => setDetailId(r.id)}
                  >
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleOne(r.id)} />
                    </TableCell>
                    <TableCell className="font-medium text-foreground text-sm">{r.memberName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.phone || '—'}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs truncate max-w-[140px]">{r.primaryReasonCode || '—'}</Badge></TableCell>
                    <TableCell className="text-center">
                      {r.preventabilityScore != null ? (
                        <span className={`inline-flex items-center justify-center w-10 h-6 rounded text-xs font-bold ${scoreColor(r.preventabilityScore)}`}>
                          {r.preventabilityScore}/10
                        </span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{r.normalizedAddressability}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.callDate ? format(new Date(r.callDate), 'MMM d, yyyy') : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {r.flagged && <Badge variant="destructive" className="text-[10px]">Flagged</Badge>}
                        {r.audited && <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">Audited</Badge>}
                        {!r.flagged && !r.audited && <Badge variant="secondary" className="text-[10px]">—</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setDetailId(r.id)}>
                        <Eye className="w-3.5 h-3.5" /> View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {pageData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-sm text-muted-foreground">
                      No records match your filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <p className="text-muted-foreground">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="px-2 text-xs text-muted-foreground">{page + 1} / {totalPages}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <MemberDetailPanel
        open={!!detailId}
        onOpenChange={(open) => { if (!open) setDetailId(null); }}
        transcriptionId={detailId}
        onAuditSaved={fetchRecords}
      />
    </>
  );
}
