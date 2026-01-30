import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserX, Sparkles } from 'lucide-react';

interface NonBookingMissedOpportunitiesPanelProps {
  highReadinessCount: number;
  dateRange: string;
}

export function NonBookingMissedOpportunitiesPanel({ 
  highReadinessCount,
  dateRange 
}: NonBookingMissedOpportunitiesPanelProps) {
  // This panel will show AI-analyzed missed opportunities in the future
  // For now, show placeholder with basic stats
  
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <UserX className="h-5 w-5 text-destructive" />
            Missed Opportunities
          </CardTitle>
          <Badge variant="destructive" className="text-xs">
            {highReadinessCount} found
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Members who engaged deeply but didn't book
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] flex flex-col items-center justify-center text-center">
          <div className="p-4 rounded-full bg-amber-500/10 mb-4">
            <Sparkles className="h-8 w-8 text-amber-500" />
          </div>
          <h4 className="font-medium mb-2">AI Analysis Coming Soon</h4>
          <p className="text-sm text-muted-foreground max-w-[280px] mb-4">
            We detected {highReadinessCount} high-readiness non-bookers (5+ min calls).
            Run AI analysis to identify specific recovery opportunities.
          </p>
          <div className="grid grid-cols-2 gap-4 w-full max-w-[280px]">
            <div className="p-3 rounded-lg bg-muted text-center">
              <p className="text-2xl font-bold text-destructive">{highReadinessCount}</p>
              <p className="text-xs text-muted-foreground">High Readiness</p>
            </div>
            <div className="p-3 rounded-lg bg-muted text-center">
              <p className="text-2xl font-bold text-amber-500">--</p>
              <p className="text-xs text-muted-foreground">Recoverable</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
