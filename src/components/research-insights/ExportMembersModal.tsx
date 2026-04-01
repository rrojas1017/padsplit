import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Download, Search, Users } from 'lucide-react';
import { useExportMembers, type ExportFilter, type ExportMember } from '@/hooks/useExportMembers';
import { format } from 'date-fns';

interface ExportMembersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filter: ExportFilter;
  title: string;
  subtitle?: string;
  defaultFilename?: string;
}

function prevScoreColor(score: number | null) {
  if (score == null) return 'text-muted-foreground';
  if (score >= 7) return 'text-destructive';
  if (score >= 4) return 'text-amber-500';
  return 'text-emerald-600';
}

function prevScoreBg(score: number | null) {
  if (score == null) return '';
  if (score >= 7) return 'bg-destructive/10';
  if (score >= 4) return 'bg-amber-500/10';
  return 'bg-emerald-600/10';
}

export function ExportMembersModal({ open, onOpenChange, filter, title, subtitle, defaultFilename }: ExportMembersModalProps) {
  const { members, isLoading, fetchMembers, exportCSV } = useExportMembers();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      setSearch('');
      setSelected(new Set());
      fetchMembers(filter);
    }
  }, [open, filter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter(m =>
      m.memberName.toLowerCase().includes(q) ||
      m.phone.includes(q) ||
      m.primaryReasonCode.toLowerCase().includes(q) ||
      m.keyQuote.toLowerCase().includes(q)
    );
  }, [members, search]);

  const allSelected = filtered.length > 0 && filtered.every(m => selected.has(m.bookingId));
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(m => m.bookingId)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleExport = () => {
    const toExport = someSelected
      ? filtered.filter(m => selected.has(m.bookingId))
      : filtered;
    const filename = defaultFilename || 'export_members.csv';
    exportCSV(toExport, filename);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            {title}
          </DialogTitle>
          {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
        </DialogHeader>

        <div className="flex items-center gap-2 mt-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Badge variant="secondary">{filtered.length} members</Badge>
          <Button size="sm" onClick={handleExport} disabled={isLoading || filtered.length === 0}>
            <Download className="w-4 h-4 mr-1" />
            {someSelected ? `Export ${selected.size}` : 'Export All'}
          </Button>
        </div>

        <div className="flex-1 overflow-auto border border-border rounded-lg mt-2">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No matching members found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="hidden md:table-cell">Booking ID</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="w-16">Score</TableHead>
                  <TableHead className="hidden lg:table-cell">Quote</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 100).map((m) => (
                  <TableRow key={m.bookingId} className={selected.has(m.bookingId) ? 'bg-primary/5' : ''}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(m.bookingId)}
                        onCheckedChange={() => toggleOne(m.bookingId)}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-foreground text-sm">{m.memberName}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{m.phone || '—'}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground font-mono">
                      {m.bookingId.substring(0, 8)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs truncate max-w-[120px]">{m.primaryReasonCode || '—'}</Badge>
                    </TableCell>
                    <TableCell>
                      {m.preventabilityScore != null ? (
                        <span className={`text-sm font-semibold px-2 py-0.5 rounded ${prevScoreColor(m.preventabilityScore)} ${prevScoreBg(m.preventabilityScore)}`}>
                          {m.preventabilityScore}/10
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell max-w-[180px]">
                      <span className="text-xs text-muted-foreground line-clamp-2" title={m.keyQuote}>{m.keyQuote || '—'}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {m.callDate ? format(new Date(m.callDate), 'MMM d, yyyy') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {filtered.length > 100 && (
            <div className="p-2 text-center text-xs text-muted-foreground border-t border-border">
              Showing first 100 of {filtered.length}. Export to see all.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
