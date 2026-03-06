import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Calendar, User, Quote } from 'lucide-react';
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
  /** Pre-mapped booking IDs from the report (new reports include these) */
  bookingIds?: string[];
  /** Included reason codes from the report category */
  includedReasonCodes?: string[];
  /** Category description for keyword extraction */
  categoryDescription?: string;
}

// Semantic keyword sets for known high-level categories
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'positive': ['graduation', 'positive', 'life event', 'personal', 'external', 'planned', 'found other', 'found better', 'relocation', 'moving', 'unavoidable', 'voluntary', 'natural', 'upgrade', 'better opportunity', 'job change', 'family', 'marriage', 'milestone'],
  'host': ['property', 'host', 'maintenance', 'safety', 'habitability', 'pest', 'mold', 'conditions', 'landlord', 'repair', 'cleanliness', 'utilities', 'broken', 'infestation', 'violation', 'unresponsive host'],
  'financial': ['financial', 'payment', 'afford', 'hardship', 'billing', 'cant afford', 'eviction', 'fee', 'cost', 'price', 'income', 'job loss', 'unemploy', 'debt', 'money', 'economic', 'rent increase'],
  'roommate': ['roommate', 'conflict', 'assault', 'threat', 'harassment', 'noise', 'disrespect', 'theft', 'fighting', 'uncomfortable', 'hostile', 'altercation', 'violence', 'intimidation'],
  'platform': ['platform', 'process', 'policy', 'bug', 'house rules', 'support', 'communication', 'transfer', 'app', 'system', 'rule', 'admin', 'management', 'customer service', 'response time'],
  'other': ['other', 'unknown', 'unresponsive', 'unclear', 'not specified', 'n/a', 'miscellaneous'],
};

function extractKeywordsFromCategory(categoryName: string, description?: string): string[] {
  const text = `${categoryName} ${description || ''}`.toLowerCase();
  const matchedKeywords: string[] = [];

  for (const [, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw)) {
        matchedKeywords.push(...keywords);
        break; // Found a match for this category, include all its keywords
      }
    }
  }

  // Also extract individual words from the category name as fallback
  const words = categoryName.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3);
  matchedKeywords.push(...words);

  return [...new Set(matchedKeywords)];
}

function recordMatchesCategory(
  classification: any,
  keywords: string[],
  includedReasonCodes?: string[]
): boolean {
  if (!classification) return false;

  const code = (classification.primary_reason_code || classification.reason_code || '').toLowerCase();
  const rootCause = (classification.root_cause_summary || classification.root_cause || classification.summary || '').toLowerCase();
  const subReasons = (classification.sub_reasons || []).join(' ').toLowerCase();
  const searchText = `${code} ${rootCause} ${subReasons}`;

  // Check against included reason codes first (most precise)
  if (includedReasonCodes?.length) {
    const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normCode = normalise(code);
    for (const irc of includedReasonCodes) {
      const normIrc = normalise(irc);
      if (normCode.includes(normIrc) || normIrc.includes(normCode)) return true;
    }
  }

  // Check against semantic keywords
  for (const kw of keywords) {
    if (searchText.includes(kw.toLowerCase())) return true;
  }

  return false;
}

export function ReasonCodeDrillDown({
  open, onOpenChange, reasonCode, reasonColor, bookingIds, includedReasonCodes, categoryDescription
}: ReasonCodeDrillDownProps) {
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
      // Strategy 1: If we have booking IDs from the report, fetch directly
      if (bookingIds?.length) {
        const { data, error } = await supabase
          .from('booking_transcriptions')
          .select('booking_id, research_classification, bookings!inner(id, member_name, booking_date)')
          .in('booking_id', bookingIds);

        if (!error && data?.length) {
          const matched = data.map((row: any) => {
            const booking = row.bookings as any;
            const cls = row.research_classification as any;
            return {
              bookingId: row.booking_id,
              memberName: booking?.member_name || 'Unknown',
              bookingDate: booking?.booking_date || '',
              preventabilityScore: cls?.preventability_score ?? cls?.preventability ?? null,
              rootCauseSummary: cls?.root_cause_summary || cls?.root_cause || cls?.summary || null,
              keyQuote: cls?.key_quote || cls?.supporting_quote || null,
              primaryReasonCode: cls?.primary_reason_code || cls?.reason_code || '',
              classification: cls,
            };
          }).sort((a: DrillDownRecord, b: DrillDownRecord) => (b.bookingDate > a.bookingDate ? 1 : -1));
          setRecords(matched);
          setIsLoading(false);
          return;
        }
      }

      // Strategy 2 & 3: Keyword matching fallback
      const { data, error } = await supabase
        .from('booking_transcriptions')
        .select('booking_id, research_classification, bookings!inner(id, member_name, booking_date, record_type, has_valid_conversation)')
        .eq('research_processing_status', 'completed')
        .not('research_classification', 'is', null);

      if (error) throw error;

      const keywords = extractKeywordsFromCategory(reasonCode, categoryDescription);
      const matched: DrillDownRecord[] = [];

      for (const row of data || []) {
        const booking = row.bookings as any;
        if (booking?.record_type !== 'research' || !booking?.has_valid_conversation) continue;

        const cls = row.research_classification as any;
        if (!cls) continue;

        if (recordMatchesCategory(cls, keywords, includedReasonCodes)) {
          matched.push({
            bookingId: row.booking_id,
            memberName: booking.member_name || 'Unknown',
            bookingDate: booking.booking_date || '',
            preventabilityScore: cls.preventability_score ?? cls.preventability ?? null,
            rootCauseSummary: cls.root_cause_summary || cls.root_cause || cls.summary || null,
            keyQuote: cls.key_quote || cls.supporting_quote || null,
            primaryReasonCode: cls.primary_reason_code || cls.reason_code || '',
            classification: cls,
          });
        }
      }

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
                    {rec.primaryReasonCode && (
                      <div>
                        <p className="text-xs font-medium text-foreground mb-1">Reason Code</p>
                        <Badge variant="outline" className="text-xs">{rec.primaryReasonCode}</Badge>
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
