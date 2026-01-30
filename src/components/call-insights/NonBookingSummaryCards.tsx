import { Card, CardContent } from '@/components/ui/card';
import { Phone, CheckCircle, UserCheck, Clock } from 'lucide-react';

interface NonBookingStats {
  totalCalls: number;
  transcribedCalls: number;
  avgDurationSeconds: number;
  highReadinessCalls: number;
}

interface NonBookingSummaryCardsProps {
  stats: NonBookingStats;
}

export function NonBookingSummaryCards({ stats }: NonBookingSummaryCardsProps) {
  const { totalCalls, transcribedCalls, avgDurationSeconds, highReadinessCalls } = stats;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const transcribedPercent = totalCalls > 0 ? Math.round((transcribedCalls / totalCalls) * 100) : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Non-Booking Calls */}
      <Card className="relative overflow-hidden">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Non-Booking Calls</p>
              <p className="text-3xl font-bold">{totalCalls.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">
                In selected period
              </p>
            </div>
            <div className="p-3 rounded-full bg-amber-500/10">
              <Phone className="h-6 w-6 text-amber-500" />
            </div>
          </div>
        </CardContent>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500/50 to-orange-500/50" />
      </Card>

      {/* Transcribed */}
      <Card className="relative overflow-hidden">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Transcribed</p>
              <p className="text-3xl font-bold">{transcribedCalls.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {transcribedPercent}% of total
              </p>
            </div>
            <div className="p-3 rounded-full bg-green-500/10">
              <CheckCircle className="h-6 w-6 text-green-500" />
            </div>
          </div>
        </CardContent>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500/50 to-emerald-500/50" />
      </Card>

      {/* High Readiness (Missed Opportunities) */}
      <Card className="relative overflow-hidden">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">High Readiness</p>
              <p className="text-3xl font-bold">{highReadinessCalls.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Potential missed opportunities
              </p>
            </div>
            <div className="p-3 rounded-full bg-destructive/10">
              <UserCheck className="h-6 w-6 text-destructive" />
            </div>
          </div>
        </CardContent>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-destructive/50 to-red-500/50" />
      </Card>

      {/* Average Duration */}
      <Card className="relative overflow-hidden">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Avg Duration</p>
              <p className="text-3xl font-bold font-mono">{formatDuration(avgDurationSeconds)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Average call length
              </p>
            </div>
            <div className="p-3 rounded-full bg-primary/10">
              <Clock className="h-6 w-6 text-primary" />
            </div>
          </div>
        </CardContent>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/50 to-accent/50" />
      </Card>
    </div>
  );
}
