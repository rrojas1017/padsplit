import { useState, useEffect, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Download, Search, Quote, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { MemberDetailPanel } from './MemberDetailPanel';

interface DrillDownRecord {
  transcriptionId: string;
  bookingId: string;
  memberName: string;
  phone: string | null;
  bookingDate: string;
  preventabilityScore: number | null;
  keyQuote: string | null;
  primaryReasonCode: string;
}

interface ReasonCodeDrillDownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reasonCode: string;
  reasonColor: string;
  reasonCount?: number;
  reasonPct?: number;
  bookingIds?: string[];
  includedReasonCodes?: string[];
  categoryDescription?: string;
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  positive: ['graduation', 'positive', 'life event', 'personal', 'external', 'planned', 'found other', 'relocation', 'moving', 'unavoidable', 'voluntary', 'upgrade', 'better opportunity', 'job change', 'family', 'marriage', 'milestone'],
  host: ['property', 'host', 'maintenance', 'safety', 'habitability', 'pest', 'mold', 'conditions', 'landlord', 'repair', 'cleanliness', 'utilities', 'broken', 'infestation', 'violation', 'unresponsive host'],
  financial: ['financial', 'payment', 'afford', 'hardship', 'billing', 'cant afford', 'eviction', 'fee', 'cost', 'price', 'income', 'job loss', 'unemploy', 'debt', 'money', 'economic', 'rent increase'],
  roommate: ['roommate', 'conflict', 'assault', 'threat', 'harassment', 'noise', 'disrespect', 'theft', 'fighting', 'uncomfortable', 'hostile', 'altercation', 'violence', 'intimidation'],
  platform: ['platform', 'process', 'policy', 'bug', 'house rules', 'support', 'communication', 'transfer', 'app', 'system', 'rule', 'admin', 'management', 'customer service', 'response time'],
  other: ['other', 'unknown', 'unresponsive', 'unclear', 'not specified', 'n/a', 'miscellaneous'],
};

function extractKeywords(categoryName: string, description?: string): string[] {
  const text = `${categoryName} ${description || ''}`.toLowerCase();
  const matched: string[] = [];
  for (const [, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw)) { matched.push(...keywords); break; }
    }
  }
  const words = categoryName.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3);
  matched.push(...words);
  return [...new Set(matched)];
}

function recordMatchesCategory(cls: any, keywords: string[], includedCodes?: string[]): boolean {
  if (!cls) return false;
  const code = (cls.primary_reason_code || cls.reason_code || '').toLowerCase();
  const rootCause = (cls.root_cause_summary || cls.root_cause || cls.summary || '').toLowerCase();
  const subReasons = (cls.sub_reasons || []).join(' ').toLowerCase();
  const searchText = `${code} ${rootCause} ${subReasons}`;

  if (includedCodes?.length) {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normCode = norm(code);
    for (const irc of includedCodes) {
      const n = norm(irc);
      if (normCode.includes(n) || n.includes(normCode)) return true;
    }
  }
  for (const kw of keywords) {
    if (searchText.includes(kw.toLowerCase())) return true;
  }
  return false;
}

function prevScoreColor(score: number | null) {
  if (score == null) return 'text-muted-foreground';
  if (score >= 7) return 'text-destructive';
  if (score >= 4) return 'text-amber-500';
  return 'text-green-600';
}

function prevScoreBg(score: number | null) {
  if (score == null) return '';
  if (score >= 7) return 'bg-destructive/10';
  if (score >= 4) return 'bg-amber-500/10';
  return 'bg-green-600/10';
}

export function ReasonCodeDrillDown({
  open, onOpenChange, reasonCode, reasonColor,
  reasonCount, reasonPct, bookingIds, includedReasonCodes, categoryDescription,
}: ReasonCodeDrillDownProps) {
  const [records, setRecords] = useState<DrillDownRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !reasonCode) return;
    setSearch('');
    setSelected(new Set());
    fetchRecords();
  }, [open, reasonCode]);

  const fetchRecords = async () => {
    setIsLoading(true);
    setRecords([]);
    try {
      if (bookingIds?.length) {
        const { data, error } = await supabase
          .from('booking_transcriptions')
          .select('id, booking_id, research_classification, bookings!inner(id, member_name, booking_date, contact_phone)')
          .in('booking_id', bookingIds);
        if (!error && data?.length) {
          setRecords(mapRecords(data));
          setIsLoading(false);
          return;
        }
      }

      const { data, error } = await supabase
        .from('booking_transcriptions')
        .select('id, booking_id, research_classification, bookings!inner(id, member_name, booking_date, record_type, has_valid_conversation, contact_phone)')
        .eq('research_processing_status', 'completed')
        .not('research_classification', 'is', null);
      if (error) throw error;

      const keywords = extractKeywords(reasonCode, categoryDescription);
      const matched = (data || []).filter((row: any) => {
        const b = row.bookings as any;
        return b?.record_type === 'research' && b?.has_valid_conversation && recordMatchesCategory(row.research_classification, keywords, includedReasonCodes);
      });
      setRecords(mapRecords(matched));
    } catch (err) {
      console.error('Drill-down fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  function mapRecords(data: any[]): DrillDownRecord[] {
    return data.map((row: any) => {
      const b = row.bookings as any;
      const cls = row.research_classification as any;
      const rawName = b?.member_name || '';
      const isApiPlaceholder = rawName.startsWith('API Submission');
      const extractedName = cls?.respondent_name || cls?.member_name || '';
      const cleanPhone = b?.contact_phone || rawName.replace('API Submission - ', '');
      const memberName = isApiPlaceholder
        ? (extractedName || cleanPhone || 'Unknown')
        : (rawName || 'Unknown');
      return {
        transcriptionId: row.id,
        bookingId: row.booking_id,
        memberName,
        phone: b?.contact_phone || null,
        bookingDate: b?.booking_date || '',
        preventabilityScore: cls?.preventability_score ?? cls?.preventability ?? null,
        keyQuote: cls?.key_quote || cls?.supporting_quote || null,
        primaryReasonCode: cls?.primary_reason_code || cls?.reason_code || '',
      };
    }).sort((a, b) => (b.bookingDate > a.bookingDate ? 1 : -1));
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return records;
    const q = search.toLowerCase();
    return records.filter(r =>
      r.memberName.toLowerCase().includes(q) ||
      r.phone?.toLowerCase().includes(q) ||
      r.primaryReasonCode.toLowerCase().includes(q) ||
      r.keyQuote?.toLowerCase().includes(q)
    );
  }, [records, search]);

  const allSelected = filtered.length > 0 && filtered.every(r => selected.has(r.bookingId));

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(r => r.bookingId)));
    }
  }

  function toggleOne(id: string) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  function exportCSV(subset?: DrillDownRecord[]) {
    const rows = subset || filtered;
    const header = 'Member Name,Phone,Booking ID,Preventability Score,Key Quote,Call Date\n';
    const csv = header + rows.map(r =>
      [
        `"${(r.memberName || '').replace(/"/g, '""')}"`,
        `"${(r.phone || '').replace(/"/g, '""')}"`,
        r.bookingId,
        r.preventabilityScore ?? '',
        `"${(r.keyQuote || '').replace(/"/g, '""')}"`,
        r.bookingDate,
      ].join(',')
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reasonCode.replace(/\s+/g, '_')}_members.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const headerText = reasonCount != null
    ? `${reasonCode} — ${reasonCount} cases${reasonPct != null ? `, ${reasonPct.toFixed(1)}%` : ''}`
    : reasonCode;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-3xl overflow-y-auto p-0">
          <div className="sticky top-0 z-10 bg-card border-b border-border px-6 py-4 space-y-3">
            <SheetHeader className="space-y-1">
              <SheetTitle className="flex items-center gap-2 text-base">
                <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: reasonColor }} />
                {headerText}
              </SheetTitle>
              <SheetDescription>
                {isLoading ? 'Loading records...' : `${filtered.length} member${filtered.length !== 1 ? 's' : ''} found`}
              </SheetDescription>
            </SheetHeader>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search members, phone, quotes..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
              {selected.size > 0 && (
                <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => exportCSV(filtered.filter(r => selected.has(r.bookingId)))}>
                  <Download className="w-3.5 h-3.5" />
                  Export {selected.size}
                </Button>
              )}
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => exportCSV()}>
                <Download className="w-3.5 h-3.5" />
                Export All
              </Button>
            </div>
          </div>

          <div className="px-2">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">No matching records found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                    </TableHead>
                    <TableHead className="text-xs">Member</TableHead>
                    <TableHead className="text-xs">Phone</TableHead>
                    <TableHead className="text-xs w-24 text-center">Preventability</TableHead>
                    <TableHead className="text-xs">Key Quote</TableHead>
                    <TableHead className="text-xs w-28">Date</TableHead>
                    <TableHead className="text-xs w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(rec => (
                    <TableRow
                      key={rec.bookingId}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setDetailId(rec.transcriptionId)}
                    >
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(rec.bookingId)}
                          onCheckedChange={() => toggleOne(rec.bookingId)}
                          aria-label={`Select ${rec.memberName}`}
                        />
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium text-foreground">{rec.memberName}</span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{rec.phone || '—'}</TableCell>
                      <TableCell className="text-center">
                        {rec.preventabilityScore != null ? (
                          <span className={`inline-flex items-center justify-center w-8 h-6 rounded text-xs font-bold ${prevScoreColor(rec.preventabilityScore)} ${prevScoreBg(rec.preventabilityScore)}`}>
                            {rec.preventabilityScore}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {rec.keyQuote ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <p className="text-xs text-muted-foreground italic line-clamp-2 max-w-[200px] cursor-help">
                                  <Quote className="w-3 h-3 inline mr-0.5 -mt-0.5" />
                                  {rec.keyQuote}
                                </p>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-sm">
                                <p className="text-xs italic">"{rec.keyQuote}"</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {rec.bookingDate ? format(new Date(rec.bookingDate), 'MMM d, yyyy') : '—'}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={(e) => { e.stopPropagation(); setDetailId(rec.transcriptionId); }}>
                          <Eye className="w-3.5 h-3.5" /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <MemberDetailPanel
        open={!!detailId}
        onOpenChange={(o) => { if (!o) setDetailId(null); }}
        transcriptionId={detailId}
      />
    </>
  );
}
