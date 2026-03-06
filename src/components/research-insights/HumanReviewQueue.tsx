import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { AlertTriangle, CheckCircle, XCircle, FileText, Loader2, CheckCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface ReviewItem {
  id: string;
  booking_id: string;
  member_name: string;
  booking_date: string;
  reason_code: string;
  review_reason: string;
  confidence: number | null;
  key_quotes: string[];
  classification: any;
}

const REASON_CODES = [
  'Payment Issues',
  'Property Conditions',
  'Host/Roommate Conflict',
  'Personal/Life Change',
  'Employment Change',
  'Transportation Issues',
  'Safety Concerns',
  'Lease/Policy Dispute',
  'Better Alternative Found',
  'Maintenance Issues',
  'Noise/Environment',
  'Other',
];

interface HumanReviewQueueProps {
  onReviewComplete?: () => void;
}

export function HumanReviewQueue({ onReviewComplete }: HumanReviewQueueProps) {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [overrideCode, setOverrideCode] = useState<Record<string, string>>({});

  const fetchReviewQueue = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('booking_transcriptions')
        .select('id, booking_id, research_classification, bookings!inner(member_name, booking_date)')
        .eq('research_human_review', true)
        .not('research_classification', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const mapped = (data || []).map((d: any) => ({
        id: d.id,
        booking_id: d.booking_id,
        member_name: d.bookings?.member_name || 'Unknown',
        booking_date: d.bookings?.booking_date || '',
        reason_code: d.research_classification?.primary_reason_code || 'Unknown',
        review_reason: d.research_classification?.human_review_reason || 'Flagged for review',
        confidence: d.research_classification?.confidence_score ?? null,
        key_quotes: d.research_classification?.key_quotes || [],
        classification: d.research_classification,
      }));

      setItems(mapped);
    } catch (error) {
      console.error('Error fetching review queue:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReviewQueue();
  }, [fetchReviewQueue]);

  const handleApprove = async (item: ReviewItem) => {
    setActionLoading(item.id);
    try {
      const { error } = await supabase
        .from('booking_transcriptions')
        .update({ research_human_review: false })
        .eq('id', item.id);

      if (error) throw error;

      setItems(prev => prev.filter(i => i.id !== item.id));
      toast.success(`Approved classification for ${item.member_name}`);
      onReviewComplete?.();
    } catch (error) {
      console.error('Error approving:', error);
      toast.error('Failed to approve');
    } finally {
      setActionLoading(null);
    }
  };

  const handleOverride = async (item: ReviewItem) => {
    const newCode = overrideCode[item.id];
    if (!newCode) {
      toast.error('Select a reason code first');
      return;
    }

    setActionLoading(item.id);
    try {
      const updatedClassification = {
        ...item.classification,
        primary_reason_code: newCode,
        overridden_by_human: true,
        original_reason_code: item.reason_code,
      };

      const { error } = await supabase
        .from('booking_transcriptions')
        .update({
          research_human_review: false,
          research_classification: updatedClassification,
        })
        .eq('id', item.id);

      if (error) throw error;

      setItems(prev => prev.filter(i => i.id !== item.id));
      toast.success(`Overridden to "${newCode}" for ${item.member_name}`);
      onReviewComplete?.();
    } catch (error) {
      console.error('Error overriding:', error);
      toast.error('Failed to override');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDismiss = async (item: ReviewItem) => {
    setActionLoading(item.id);
    try {
      const { error } = await supabase
        .from('booking_transcriptions')
        .update({ research_human_review: false })
        .eq('id', item.id);

      if (error) throw error;

      setItems(prev => prev.filter(i => i.id !== item.id));
      toast.success(`Dismissed review for ${item.member_name}`);
      onReviewComplete?.();
    } catch (error) {
      console.error('Error dismissing:', error);
      toast.error('Failed to dismiss');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkApprove = async () => {
    setBulkLoading(true);
    try {
      const ids = items.map(i => i.id);
      const { error } = await supabase
        .from('booking_transcriptions')
        .update({ research_human_review: false })
        .in('id', ids);

      if (error) throw error;

      toast.success(`Approved all ${items.length} items`);
      setItems([]);
      onReviewComplete?.();
    } catch (error) {
      console.error('Error bulk approving:', error);
      toast.error('Failed to bulk approve');
    } finally {
      setBulkLoading(false);
    }
  };

  if (isLoading) return null;
  if (!items.length) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Human Review Queue
            <Badge variant="secondary">{items.length}</Badge>
          </CardTitle>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5" disabled={bulkLoading}>
                {bulkLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
                Approve All
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Approve all {items.length} items?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will accept the AI's classification for all flagged records and clear them from the review queue.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleBulkApprove}>Approve All</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="space-y-2">
          {items.map((item) => (
            <AccordionItem key={item.id} value={item.id} className="border rounded-lg px-3">
              <AccordionTrigger className="py-3 hover:no-underline">
                <div className="flex items-center justify-between w-full mr-2">
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground">{item.member_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.booking_date ? format(new Date(item.booking_date), 'MMM d, yyyy') : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{item.reason_code}</Badge>
                    {item.confidence !== null && (
                      <Badge variant="secondary" className="text-xs">
                        {Math.round(item.confidence * 100)}% conf
                      </Badge>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-1 pb-2">
                  {/* Review reason */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Why flagged</p>
                    <p className="text-sm text-foreground">{item.review_reason}</p>
                  </div>

                  {/* Key quotes */}
                  {item.key_quotes.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Key Quotes</p>
                      <div className="space-y-1">
                        {item.key_quotes.slice(0, 3).map((q, i) => (
                          <p key={i} className="text-xs text-muted-foreground italic border-l-2 border-border pl-2">
                            "{q}"
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Override selector */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Override Reason Code</p>
                    <Select
                      value={overrideCode[item.id] || ''}
                      onValueChange={(v) => setOverrideCode(prev => ({ ...prev, [item.id]: v }))}
                    >
                      <SelectTrigger className="w-full h-8 text-xs">
                        <SelectValue placeholder="Select new reason code..." />
                      </SelectTrigger>
                      <SelectContent>
                        {REASON_CODES.map(code => (
                          <SelectItem key={code} value={code} className="text-xs">{code}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      className="gap-1.5"
                      disabled={actionLoading === item.id}
                      onClick={() => handleApprove(item)}
                    >
                      {actionLoading === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="gap-1.5"
                      disabled={actionLoading === item.id || !overrideCode[item.id]}
                      onClick={() => handleOverride(item)}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Override
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-muted-foreground"
                      disabled={actionLoading === item.id}
                      onClick={() => handleDismiss(item)}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Dismiss
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
