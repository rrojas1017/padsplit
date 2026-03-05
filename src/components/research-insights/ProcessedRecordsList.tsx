import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { PriorityBadge } from './PriorityBadge';

interface ProcessedRecord {
  id: string;
  booking_id: string;
  member_name: string;
  booking_date: string;
  research_extraction: any;
  research_classification: any;
  research_processed_at: string;
}

export function ProcessedRecordsList() {
  const [records, setRecords] = useState<ProcessedRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const { data, error } = await supabase
          .from('booking_transcriptions')
          .select('id, booking_id, research_extraction, research_classification, research_processed_at, bookings!inner(member_name, booking_date)')
          .not('research_extraction', 'is', null)
          .order('research_processed_at', { ascending: false })
          .limit(100);

        if (error) throw error;

        const mapped = (data || []).map((d: any) => ({
          id: d.id,
          booking_id: d.booking_id,
          member_name: d.bookings?.member_name || 'Unknown',
          booking_date: d.bookings?.booking_date || '',
          research_extraction: d.research_extraction,
          research_classification: d.research_classification,
          research_processed_at: d.research_processed_at,
        }));

        setRecords(mapped);
      } catch (error) {
        console.error('Error fetching processed records:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecords();
  }, []);

  if (isLoading || !records.length) return null;

  const displayed = showAll ? records : records.slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Processed Records
          <Badge variant="secondary">{records.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {displayed.map((record) => (
          <RecordRow key={record.id} record={record} />
        ))}
        {records.length > 10 && (
          <Button variant="ghost" size="sm" onClick={() => setShowAll(!showAll)} className="w-full">
            {showAll ? 'Show Less' : `Show All ${records.length} Records`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function RecordRow({ record }: { record: ProcessedRecord }) {
  const [open, setOpen] = useState(false);
  const classification = record.research_classification;
  const extraction = record.research_extraction;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left">
          <div>
            <p className="text-sm font-medium text-foreground">{record.member_name}</p>
            <p className="text-xs text-muted-foreground">
              {record.booking_date ? format(new Date(record.booking_date), 'MMM d, yyyy') : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {classification?.primary_reason_code && (
              <Badge variant="outline" className="text-xs max-w-[180px] truncate">{classification.primary_reason_code}</Badge>
            )}
            {classification?.preventability_score && (
              <Badge variant={classification.preventability_score >= 7 ? 'destructive' : 'secondary'} className="text-xs">
                {classification.preventability_score}/10
              </Badge>
            )}
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="p-4 space-y-4 border border-t-0 border-border rounded-b-lg">
          {/* Classification Summary */}
          {classification && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">Classification</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Addressability:</span> <span className="text-foreground">{classification.addressability}</span></div>
                <div><span className="text-muted-foreground">Regrettability:</span> <span className="text-foreground">{classification.regrettability}</span></div>
                <div><span className="text-muted-foreground">Deterioration:</span> <span className="text-foreground">{classification.experience_deterioration}</span></div>
                <div><span className="text-muted-foreground">Framework:</span> <span className="text-foreground">{classification.categorization_framework}</span></div>
              </div>
              {classification.root_cause_summary && (
                <div className="bg-muted/50 rounded p-2">
                  <p className="text-xs text-muted-foreground">{classification.root_cause_summary}</p>
                </div>
              )}
              {classification.case_brief && (
                <div className="bg-primary/5 border border-primary/20 rounded p-2">
                  <p className="text-xs text-foreground">{classification.case_brief}</p>
                </div>
              )}
            </div>
          )}

          {/* Key Quotes */}
          {extraction?.key_quotes?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-foreground mb-1">Key Quotes</p>
              {extraction.key_quotes.slice(0, 3).map((q: string, i: number) => (
                <blockquote key={i} className="border-l-2 border-primary/40 pl-3 italic text-xs text-muted-foreground mt-1">
                  "{q}"
                </blockquote>
              ))}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
