import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserX, ChevronRight, Phone, Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { Call } from '@/pages/CallInsights';

interface MissedOpportunitiesPanelProps {
  calls: Call[];
  onSelectCall: (call: Call) => void;
}

export function MissedOpportunitiesPanel({ calls, onSelectCall }: MissedOpportunitiesPanelProps) {
  // Filter for high-readiness calls (longer calls suggest more engaged prospects)
  // In the future, this will use AI-analyzed moveInReadiness field
  const highReadinessCalls = calls
    .filter(c => c.duration_seconds && c.duration_seconds > 300) // 5+ minute calls
    .sort((a, b) => (b.duration_seconds || 0) - (a.duration_seconds || 0))
    .slice(0, 10);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <UserX className="h-5 w-5 text-destructive" />
            Missed Opportunities
          </CardTitle>
          <Badge variant="destructive" className="text-xs">
            {highReadinessCalls.length} found
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Members who engaged deeply but didn't book
        </p>
      </CardHeader>
      <CardContent>
        {highReadinessCalls.length > 0 ? (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-3">
              {highReadinessCalls.map((call) => (
                <div
                  key={call.id}
                  className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer group"
                  onClick={() => onSelectCall(call)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">
                          {call.contact_name || 'Unknown Member'}
                        </span>
                        <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/30">
                          High Readiness
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(call.call_date), 'MMM d, yyyy')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(call.duration_seconds)}
                        </span>
                        {call.disposition && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {call.disposition.slice(0, 30)}
                            {call.disposition.length > 30 && '...'}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="h-[300px] flex flex-col items-center justify-center text-center">
            <div className="p-4 rounded-full bg-muted mb-4">
              <UserX className="h-8 w-8 text-muted-foreground" />
            </div>
            <h4 className="font-medium mb-2">No High-Readiness Non-Bookers</h4>
            <p className="text-sm text-muted-foreground max-w-[280px]">
              Members with long call durations who didn't book will appear here
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
