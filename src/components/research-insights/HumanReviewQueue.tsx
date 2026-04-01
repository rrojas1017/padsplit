import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import type { ExportFilter } from '@/hooks/useExportMembers';

const PAGE_SIZE = 20;

interface ReviewItem {
  id: string;
  booking_id: string;
  member_name: string;
  booking_date: string;
  reason_code: string;
  review_reason: string;
}
interface HumanReviewQueueProps {
  onExportModal?: (filter: ExportFilter, title: string, filename: string) => void;
}

export function HumanReviewQueue({ onExportModal }: HumanReviewQueueProps = {}) {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    const fetchReviewQueue = async () => {
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
        }));

        setItems(mapped);
      } catch (error) {
        console.error('Error fetching review queue:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReviewQueue();
  }, []);

  if (isLoading) return null;
  if (!items.length) return null;

  const visible = items.slice(0, visibleCount);
  const remaining = items.length - visibleCount;

  return (
    <Card className="shadow-sm border-amber-500/20">
      <CardHeader className="bg-amber-500/5 rounded-t-lg">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-amber-500/10 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          Human Review Queue
          <Badge variant="secondary">{items.length}</Badge>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto gap-1.5 text-xs"
            onClick={async () => {
              try {
                const count = await exportHumanReviewQueue('human_review_queue.csv');
                toast.success(`Exported ${count} flagged records`);
              } catch { toast.error('Export failed'); }
            }}
          >
            <Download className="w-3.5 h-3.5" />
            Export All
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-2">
          {visible.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border"
              style={{ borderLeftWidth: '4px', borderLeftColor: 'hsl(45, 93%, 47%)' }}
            >
              <div>
                <p className="text-sm font-medium text-foreground">{item.member_name}</p>
                <p className="text-xs text-muted-foreground">{item.booking_date ? format(new Date(item.booking_date), 'MMM d, yyyy') : ''}</p>
              </div>
              <div className="text-right">
                <Badge variant="outline" className="text-xs">{item.reason_code}</Badge>
                <p className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate">{item.review_reason}</p>
              </div>
            </div>
          ))}
          {remaining > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
              className="w-full text-primary"
            >
              Show more ({remaining} remaining)
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
