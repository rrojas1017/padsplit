import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Calendar, User, AlertTriangle, Quote } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface DrillDownRecord {
  bookingId: string;
  memberName: string;
  bookingDate: string;
  preventabilityScore: number | null;
  rootCauseSummary: string | null;
  keyQuote: string | null;
  primaryReasonCode: string;
  classification: any;
}

interface ReasonCodeDrillDownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reasonCode: string;
  reasonColor: string;
}

export function ReasonCodeDrillDown({ open, onOpenChange, reasonCode, reasonColor }: ReasonCodeDrillDownProps) {
  const [records, setRecords] = useState<DrillDownRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !reasonCode) return;
    fetchRecords();
  }, [open, reasonCode]);

  const fetchRecords = async () => {
    setIsLoading(true);
    setRecords([]);
    try {
      // Fetch all completed research records with their classification
      const { data, error } = await supabase
        .from('booking_transcriptions')
        .select('booking_id, research_classification, bookings!inner(id, member_name, booking_date, record_type, has_valid_conversation)')
        .eq('research_processing_status', 'completed')
        .not('research_classification', 'is', null);

      if (error) throw error;

      // Client-side filter by primary_reason_code matching
      const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
      const targetNorm = normalise(reasonCode);

      const matched: DrillDownRecord[] = [];
      for (const row of data || []) {
        const booking = row.bookings as any;
        if (booking?.record_type !== 'research' || !booking?.has_valid_conversation) continue;

        const cls = row.research_classification as any;
        if (!cls) continue;

        const code = cls.primary_reason_code || cls.reason_code || '';
        const codeNorm = normalise(code);

        // Fuzzy match: check if one contains the other or significant overlap
        if (codeNorm.includes(targetNorm) || targetNorm.includes(codeNorm) || fuzzyMatch(targetNorm, codeNorm)) {
          matched.push({
            bookingId: row.booking_id,
            memberName: booking.member_name || 'Unknown',
            bookingDate: booking.booking_date || '',
            preventabilityScore: cls.preventability_score ?? cls.preventability ?? null,
            rootCauseSummary: cls.root_cause_summary || cls.root_cause || cls.summary || null,
            keyQuote: cls.key_quote || cls.supporting_quote || null,
            primaryReasonCode: code,
            classification: cls,
          });
        }
      }

      // Sort by date descending
      matched.sort((a, b) => (b.bookingDate > a.bookingDate ? 1 : -1));
      setRecords(matched);
    } catch (err) {
      console.error('Error fetching drill-down records:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: reasonColor }} />
            {reasonCode}
          </DialogTitle>
          <DialogDescription>
            {isLoading ? 'Loading records...' : `${records.length} matching research record${records.length !== 1 ? 's' : ''}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 mt-2">
          {isLoading && (
            <>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </>
          )}

          {!isLoading && records.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No matching records found.</p>
          )}

          {records.map((rec) => {
            const isExpanded = expandedId === rec.bookingId;
            return (
              <Collapsible key={rec.bookingId} open={isExpanded} onOpenChange={() => setExpandedId(isExpanded ? null : rec.bookingId)}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors">
                    <div className="mt-0.5">
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground">{rec.memberName}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {rec.preventabilityScore != null && (
                            <Badge variant={rec.preventabilityScore >= 7 ? 'destructive' : rec.preventabilityScore >= 4 ? 'secondary' : 'outline'} className="text-xs">
                              {rec.preventabilityScore >= 7 ? 'Preventable' : rec.preventabilityScore >= 4 ? 'Partial' : 'Unpreventable'}
                            </Badge>
                          )}
                          {rec.bookingDate && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(rec.bookingDate), 'MMM d, yyyy')}
                            </span>
                          )}
                        </div>
                      </div>
                      {rec.rootCauseSummary && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{rec.rootCauseSummary}</p>
                      )}
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-7 mr-3 mb-2 p-3 rounded-lg bg-muted/30 border border-border/50 space-y-3">
                    {rec.rootCauseSummary && (
                      <div>
                        <p className="text-xs font-medium text-foreground mb-1">Root Cause</p>
                        <p className="text-xs text-muted-foreground">{rec.rootCauseSummary}</p>
                      </div>
                    )}
                    {rec.keyQuote && (
                      <div>
                        <p className="text-xs font-medium text-foreground mb-1 flex items-center gap-1">
                          <Quote className="w-3 h-3" /> Key Quote
                        </p>
                        <p className="text-xs text-muted-foreground italic">"{rec.keyQuote}"</p>
                      </div>
                    )}
                    {rec.preventabilityScore != null && (
                      <div>
                        <p className="text-xs font-medium text-foreground mb-1">Preventability Score</p>
                        <p className="text-xs text-muted-foreground">{rec.preventabilityScore}/10</p>
                      </div>
                    )}
                    {rec.classification?.sub_reasons?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-foreground mb-1">Sub-Reasons</p>
                        <div className="flex flex-wrap gap-1">
                          {rec.classification.sub_reasons.map((sr: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-xs">{sr}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function fuzzyMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  // Check if they share at least 60% of the longer string
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (shorter.length < 4) return false;
  
  // Simple word overlap check
  const wordsA = a.match(/.{3}/g) || [];
  let matches = 0;
  for (const w of wordsA) {
    if (b.includes(w)) matches++;
  }
  return wordsA.length > 0 && matches / wordsA.length > 0.6;
}
