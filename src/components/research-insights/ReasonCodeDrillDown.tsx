import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';

interface DrillDownRecord {
  bookingId: string;
  memberName: string;
  bookingDate: string;
  primaryReasonCode: string;
  preventabilityScore: number | null;
  addressability: string | null;
  caseBrief: string | null;
  confidenceScore: number | null;
}

interface ReasonCodeDrillDownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupName: string;
  bookingIds?: string[];
  reasonCodesIncluded?: string[];
  campaignId?: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
}

export function ReasonCodeDrillDown({
  open,
  onOpenChange,
  groupName,
  bookingIds,
  reasonCodesIncluded,
  campaignId,
  dateRangeStart,
  dateRangeEnd,
}: ReasonCodeDrillDownProps) {
  const [records, setRecords] = useState<DrillDownRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetchRecords();
  }, [open, groupName, bookingIds]);

  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      // Strategy 1: Use booking_ids from AI report if available
      if (bookingIds && bookingIds.length > 0) {
        const { data, error } = await supabase
          .from('bookings')
          .select(`
            id, member_name, booking_date,
            booking_transcriptions!inner(research_classification)
          `)
          .in('id', bookingIds);

        if (!error && data) {
          setRecords(mapRecords(data));
          setIsLoading(false);
          return;
        }
      }

      // Strategy 2: Fallback — query by reason codes directly from DB
      if (reasonCodesIncluded && reasonCodesIncluded.length > 0) {
        let query = supabase
          .from('bookings')
          .select(`
            id, member_name, booking_date,
            booking_transcriptions!inner(research_classification, research_processing_status)
          `)
          .eq('record_type', 'research')
          .eq('has_valid_conversation', true)
          .eq('booking_transcriptions.research_processing_status', 'completed');

        if (campaignId) query = query.eq('research_call_id', campaignId);
        if (dateRangeStart) query = query.gte('booking_date', dateRangeStart);
        if (dateRangeEnd) query = query.lte('booking_date', dateRangeEnd);

        const { data, error } = await query;

        if (!error && data) {
          // Filter client-side by reason code match
          const filtered = (data as any[]).filter((r) => {
            const t = Array.isArray(r.booking_transcriptions)
              ? r.booking_transcriptions[0]
              : r.booking_transcriptions;
            const code = t?.research_classification?.primary_reason_code;
            return code && reasonCodesIncluded.some(
              (rc) => code.toLowerCase().includes(rc.toLowerCase()) || rc.toLowerCase().includes(code.toLowerCase())
            );
          });
          setRecords(mapRecords(filtered));
        }
      }
    } catch (err) {
      console.error('Failed to fetch drill-down records:', err);
    }
    setIsLoading(false);
  };

  const mapRecords = (data: any[]): DrillDownRecord[] => {
    return data.map((r: any) => {
      const t = Array.isArray(r.booking_transcriptions)
        ? r.booking_transcriptions[0]
        : r.booking_transcriptions;
      const cls = t?.research_classification || {};
      return {
        bookingId: r.id,
        memberName: r.member_name,
        bookingDate: r.booking_date,
        primaryReasonCode: cls.primary_reason_code || 'Unknown',
        preventabilityScore: cls.preventability_score ?? null,
        addressability: cls.addressability ?? null,
        caseBrief: cls.case_brief || cls.one_line_summary || null,
        confidenceScore: cls.confidence_score ?? null,
      };
    }).sort((a, b) => (b.preventabilityScore ?? 0) - (a.preventabilityScore ?? 0));
  };

  const getAddressabilityColor = (val: string | null) => {
    if (!val) return 'secondary';
    const v = val.toLowerCase();
    if (v.includes('addressable') && !v.includes('non') && !v.includes('partial')) return 'destructive';
    if (v.includes('partial')) return 'default';
    return 'secondary';
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl w-full">
        <SheetHeader>
          <SheetTitle className="text-lg">{groupName}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            {isLoading ? 'Loading...' : `${records.length} records in this group`}
          </p>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-4 pr-2">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : records.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No records found. The AI grouping may not map directly to individual reason codes.
            </p>
          ) : (
            <div className="space-y-3">
              {records.map((r) => (
                <div
                  key={r.bookingId}
                  className="border border-border rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{r.memberName}</p>
                      <p className="text-xs text-muted-foreground">{r.bookingDate}</p>
                    </div>
                    <Badge variant={getAddressabilityColor(r.addressability)} className="flex-shrink-0 text-xs">
                      {r.addressability || 'N/A'}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">{r.primaryReasonCode}</Badge>
                    {r.preventabilityScore != null && (
                      <span className="text-muted-foreground">
                        Preventability: {(r.preventabilityScore * 10).toFixed(0)}%
                      </span>
                    )}
                    {r.confidenceScore != null && (
                      <span className="text-muted-foreground">
                        Confidence: {(r.confidenceScore * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>

                  {r.caseBrief && (
                    <p className="text-xs text-muted-foreground leading-relaxed">{r.caseBrief}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
