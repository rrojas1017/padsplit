import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface ReviewItem {
  id: string;
  booking_id: string;
  member_name: string;
  booking_date: string;
  reason_code: string;
  review_reason: string;
}

export function HumanReviewQueue() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Human Review Queue
          <Badge variant="secondary">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
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
        </div>
      </CardContent>
    </Card>
  );
}
