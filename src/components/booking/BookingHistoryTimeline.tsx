import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Clock, PlusCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface EditLogEntry {
  id: string;
  user_name: string;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  edit_reason: string;
  created_at: string;
}

interface TimelineEntry {
  id: string;
  type: 'created' | 'status_change' | 'field_edit';
  timestamp: Date;
  userName: string;
  oldValue?: string | null;
  newValue?: string | null;
  reason?: string;
  fieldChanged?: string;
}

interface BookingHistoryTimelineProps {
  bookingId: string;
  bookingCreatedAt?: Date | string;
  initialStatus?: string;
  createdByName?: string;
}

const statusColors: Record<string, string> = {
  'Pending Move-In': 'bg-warning/20 text-warning border-warning/30',
  'Moved In': 'bg-success/20 text-success border-success/30',
  'Member Rejected': 'bg-destructive/20 text-destructive border-destructive/30',
  'No Show': 'bg-muted text-muted-foreground border-border',
  'Cancelled': 'bg-muted text-muted-foreground border-border',
  'Postponed': 'bg-primary/20 text-primary border-primary/30',
};

const getTimelineDotColor = (entry: TimelineEntry) => {
  if (entry.type === 'created') return 'bg-primary';
  if (entry.newValue === 'Moved In') return 'bg-success';
  if (entry.newValue === 'Postponed') return 'bg-warning';
  if (['No Show', 'Cancelled', 'Member Rejected'].includes(entry.newValue || '')) return 'bg-destructive';
  return 'bg-muted-foreground';
};

export function BookingHistoryTimeline({
  bookingId,
  bookingCreatedAt,
  initialStatus = 'Pending Move-In',
  createdByName,
}: BookingHistoryTimelineProps) {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      setIsLoading(true);

      const { data: logs, error } = await supabase
        .from('booking_edit_logs')
        .select('id, user_name, field_changed, old_value, new_value, edit_reason, created_at')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching booking history:', error);
        setIsLoading(false);
        return;
      }

      const timelineEntries: TimelineEntry[] = [];

      // Add creation entry
      if (bookingCreatedAt) {
        timelineEntries.push({
          id: 'created',
          type: 'created',
          timestamp: new Date(bookingCreatedAt),
          userName: createdByName || 'System',
          newValue: initialStatus,
        });
      }

      // Add edit log entries
      if (logs) {
        logs.forEach((log: EditLogEntry) => {
          timelineEntries.push({
            id: log.id,
            type: log.field_changed === 'status' ? 'status_change' : 'field_edit',
            timestamp: new Date(log.created_at),
            userName: log.user_name,
            oldValue: log.old_value,
            newValue: log.new_value,
            reason: log.edit_reason,
            fieldChanged: log.field_changed,
          });
        });
      }

      setEntries(timelineEntries);
      setIsLoading(false);
    };

    fetchHistory();
  }, [bookingId, bookingCreatedAt, initialStatus, createdByName]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="w-3 h-3 rounded-full mt-1.5" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No history available</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-[5px] top-2 bottom-2 w-0.5 bg-border" />

      <div className="space-y-6">
        {entries.map((entry, index) => (
          <div key={entry.id} className="relative flex gap-4 pl-0">
            {/* Timeline dot */}
            <div
              className={cn(
                'relative z-10 w-3 h-3 rounded-full mt-1.5 ring-2 ring-background',
                getTimelineDotColor(entry)
              )}
            />

            {/* Entry content */}
            <div className="flex-1 min-w-0">
              {/* Timestamp */}
              <p className="text-xs text-muted-foreground mb-1">
                {format(entry.timestamp, 'MMM d, yyyy')} at {format(entry.timestamp, 'h:mm a')}
              </p>

              {/* Entry details */}
              {entry.type === 'created' ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <PlusCircle className="w-4 h-4 text-primary" />
                    <span className="font-medium text-foreground">Booking Created</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Created by <span className="font-medium text-foreground">{entry.userName}</span>
                  </p>
                  <span
                    className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
                      statusColors[entry.newValue || ''] || 'bg-muted text-muted-foreground border-border'
                    )}
                  >
                    {entry.newValue}
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <RefreshCw className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Changed by <span className="font-medium text-foreground">{entry.userName}</span>
                    </span>
                  </div>

                  {/* Status change badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
                        statusColors[entry.oldValue || ''] || 'bg-muted text-muted-foreground border-border'
                      )}
                    >
                      {entry.oldValue || 'N/A'}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
                        statusColors[entry.newValue || ''] || 'bg-muted text-muted-foreground border-border'
                      )}
                    >
                      {entry.newValue || 'N/A'}
                    </span>
                  </div>

                  {/* Reason */}
                  {entry.reason && (
                    <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Reason: </span>
                      {entry.reason}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
