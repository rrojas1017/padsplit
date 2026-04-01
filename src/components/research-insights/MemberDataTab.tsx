import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Download, Search, ChevronLeft, ChevronRight, Quote, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { exportSelectedRecords, type ExportRecord } from '@/utils/export-report';

interface MemberRecord {
  bookingId: string;
  memberName: string;
  phone: string;
  email: string;
  primaryReasonCode: string;
  preventabilityScore: number | null;
  addressability: string;
  keyQuote: string;
  callDate: string;
  flagged: boolean;
  secondaryFactors: string;
  agentNotes: string;
}

const PAGE_SIZE = 25;

function prevColor(score: number | null) {
  if (score == null) return '';
  if (score >= 7) return 'text-destructive bg-destructive/10';
  if (score >= 4) return 'text-amber-500 bg-amber-500/10';
  return 'text-emerald-600 bg-emerald-600/10';
}

export function MemberDataTab({ isAdmin }: { isAdmin: boolean }) {
  const [records, setRecords] = useState<MemberRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [prevFilter, setPrevFilter] = useState('all');
  const [flagFilter, setFlagFilter] = useState('all');
  const [sortField, setSortField] = useState<keyof MemberRecord>('callDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    fetchAllRecords();
  }, []);

  const fetchAllRecords = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('booking_transcriptions')
        .select('booking_id, research_classification, research_extraction, research_human_review, bookings!inner(member_name, booking_date, contact_phone, contact_email, record_type, has_valid_conversation)')
        .eq('research_processing_status', 'completed')
        .not('research_classification', 'is', null);

      if (error) throw error;

      const mapped: MemberRecord[] = (data || [])
        .filter((r: any) => {
          const b = r.bookings as any;
          return b?.record_type === 'research' && b?.has_valid_conversation;
        })
        .map((r: any) => {
          const b = r.bookings as any;
          const cls = r.research_classification as any;
          const ext = r.research_extraction as any;
          const rawName = ext?.member_name || b?.member_name || 'Unknown';
          return {
            bookingId: r.booking_id,
            memberName: rawName.startsWith('API Submission - ') ? rawName.replace('API Submission - ', '') : rawName,
            phone: b?.contact_phone || '',
            email: b?.contact_email || '',
            primaryReasonCode: cls?.primary_reason_code || cls?.reason_code || '',
            preventabilityScore: cls?.preventability_score ?? cls?.preventability ?? null,
            addressability: cls?.addressability || '',
            keyQuote: cls?.key_quote || cls?.supporting_quote || '',
            callDate: b?.booking_date || '',
            flagged: !!r.research_human_review,
            secondaryFactors: (cls?.sub_reasons || []).join('; '),
            agentNotes: cls?.root_cause_summary || cls?.root_cause || cls?.summary || '',
          };
        });

      setRecords(mapped);
    } catch (err) {
      console.error('Failed to fetch member data:', err);
    } finally {
      setIsLoading(false);
    }
  };

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
        r.memberName.toLowerCase().includes(q) ||
        r.phone.includes(q) ||
        r.primaryReasonCode.toLowerCase().includes(q) ||
        r.keyQuote.toLowerCase().includes(q)
      );
    }
    if (reasonFilter !== 'all') result = result.filter(r => r.primaryReasonCode === reasonFilter);
    if (prevFilter === 'high') result = result.filter(r => r.preventabilityScore != null && r.preventabilityScore >= 7);
    else if (prevFilter === 'medium') result = result.filter(r => r.preventabilityScore != null && r.preventabilityScore >= 4 && r.preventabilityScore < 7);
    else if (prevFilter === 'low') result = result.filter(r => r.preventabilityScore != null && r.preventabilityScore < 4);
    if (flagFilter === 'flagged') result = result.filter(r => r.flagged);
    else if (flagFilter === 'not_flagged') result = result.filter(r => !r.flagged);

    result.sort((a, b) => {
      const aVal = a[sortField] ?? '';
      const bVal = b[sortField] ?? '';
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [records, search, reasonFilter, prevFilter, flagFilter, sortField, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => { setPage(0); }, [search, reasonFilter, prevFilter, flagFilter]);

  const allSelected = pageData.length > 0 && pageData.every(r => selected.has(r.bookingId));

  const toggleAll = () => {
    if (allSelected) {
      const next = new Set(selected);
      pageData.forEach(r => next.delete(r.bookingId));
      setSelected(next);
    } else {
      const next = new Set(selected);
      pageData.forEach(r => next.add(r.bookingId));
      setSelected(next);
    }
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

  const handleExport = useCallback(async () => {
    const toExport = selected.size > 0
      ? filtered.filter(r => selected.has(r.bookingId))
      : filtered;
    const exportRecords: ExportRecord[] = toExport.map(r => ({
      memberName: r.memberName,
      phone: r.phone,
      email: r.email,
      bookingId: r.bookingId,
      primaryReasonCode: r.primaryReasonCode,
      secondaryFactors: r.secondaryFactors,
      preventabilityScore: r.preventabilityScore,
      addressability: r.addressability,
      keyQuote: r.keyQuote,
      callDate: r.callDate,
      agentNotes: r.agentNotes,
    }));
    await exportSelectedRecords(exportRecords, selected.size > 0 ? `Selected-Members` : 'All-Members');
  }, [filtered, selected]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            All Processed Records
            <Badge variant="secondary" className="text-xs">{filtered.length}</Badge>
          </CardTitle>
          {isAdmin && (
            <Button size="sm" onClick={handleExport} className="gap-1.5">
              <Download className="w-4 h-4" />
              {selected.size > 0 ? `Export ${selected.size} Selected` : 'Export All'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search name, phone, reason..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={reasonFilter} onValueChange={setReasonFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Reason Code" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Reasons</SelectItem>
              {reasonCodes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={prevFilter} onValueChange={setPrevFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Preventability" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Scores</SelectItem>
              <SelectItem value="high">High (7-10)</SelectItem>
              <SelectItem value="medium">Medium (4-6)</SelectItem>
              <SelectItem value="low">Low (1-3)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={flagFilter} onValueChange={setFlagFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="flagged">Flagged</SelectItem>
              <SelectItem value="not_flagged">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="border border-border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"><Checkbox checked={allSelected} onCheckedChange={toggleAll} /></TableHead>
                <TableHead className="cursor-pointer text-xs" onClick={() => handleSort('memberName')}>Name {sortField === 'memberName' && (sortDir === 'asc' ? '↑' : '↓')}</TableHead>
                <TableHead className="cursor-pointer text-xs" onClick={() => handleSort('phone')}>Phone</TableHead>
                <TableHead className="cursor-pointer text-xs hidden md:table-cell" onClick={() => handleSort('bookingId')}>ID</TableHead>
                <TableHead className="cursor-pointer text-xs" onClick={() => handleSort('primaryReasonCode')}>Reason {sortField === 'primaryReasonCode' && (sortDir === 'asc' ? '↑' : '↓')}</TableHead>
                <TableHead className="cursor-pointer text-xs w-20 text-center" onClick={() => handleSort('preventabilityScore')}>Score {sortField === 'preventabilityScore' && (sortDir === 'asc' ? '↑' : '↓')}</TableHead>
                <TableHead className="text-xs hidden lg:table-cell">Quote</TableHead>
                <TableHead className="cursor-pointer text-xs w-24" onClick={() => handleSort('callDate')}>Date {sortField === 'callDate' && (sortDir === 'asc' ? '↑' : '↓')}</TableHead>
                <TableHead className="text-xs w-20">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageData.map(r => (
                <>
                  <TableRow
                    key={r.bookingId}
                    className={`cursor-pointer ${selected.has(r.bookingId) ? 'bg-primary/5' : ''} ${expandedRow === r.bookingId ? 'border-b-0' : ''}`}
                    onClick={() => setExpandedRow(expandedRow === r.bookingId ? null : r.bookingId)}
                  >
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Checkbox checked={selected.has(r.bookingId)} onCheckedChange={() => toggleOne(r.bookingId)} />
                    </TableCell>
                    <TableCell className="font-medium text-foreground text-sm">{r.memberName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.phone || '—'}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground font-mono">{r.bookingId.substring(0, 8)}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs truncate max-w-[120px]">{r.primaryReasonCode || '—'}</Badge></TableCell>
                    <TableCell className="text-center">
                      {r.preventabilityScore != null ? (
                        <span className={`inline-flex items-center justify-center w-8 h-6 rounded text-xs font-bold ${prevColor(r.preventabilityScore)}`}>
                          {r.preventabilityScore}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell max-w-[160px]">
                      {r.keyQuote ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-xs text-muted-foreground italic line-clamp-1 cursor-help">{r.keyQuote}</p>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-sm"><p className="text-xs italic">"{r.keyQuote}"</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.callDate ? format(new Date(r.callDate), 'MMM d') : '—'}
                    </TableCell>
                    <TableCell>
                      {r.flagged ? <Badge variant="destructive" className="text-[10px]">Flagged</Badge> : <Badge variant="secondary" className="text-[10px]">Done</Badge>}
                    </TableCell>
                  </TableRow>
                  {expandedRow === r.bookingId && (
                    <TableRow key={`${r.bookingId}-exp`}>
                      <TableCell colSpan={9} className="bg-muted/30 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Full Details</p>
                            <p><span className="font-medium">Email:</span> {r.email || '—'}</p>
                            <p><span className="font-medium">Addressability:</span> {r.addressability || '—'}</p>
                            <p><span className="font-medium">Secondary Factors:</span> {r.secondaryFactors || '—'}</p>
                          </div>
                          <div>
                            {r.keyQuote && (
                              <div className="bg-accent/50 border border-accent rounded-lg p-3 mb-2">
                                <div className="flex items-start gap-1.5">
                                  <Quote className="w-3 h-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                                  <p className="text-xs italic text-muted-foreground">"{r.keyQuote}"</p>
                                </div>
                              </div>
                            )}
                            {r.agentNotes && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Agent Notes / Root Cause</p>
                                <p className="text-xs text-muted-foreground">{r.agentNotes}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
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
  );
}
