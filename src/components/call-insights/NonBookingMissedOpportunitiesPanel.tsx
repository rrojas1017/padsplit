import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserX, Sparkles, AlertTriangle, Lightbulb, Flame } from 'lucide-react';
import { BuyerIntent } from '@/types';

interface MissedOpportunity {
  pattern: string;
  count: number;
  recovery_suggestion: string;
  urgency?: 'high' | 'medium' | 'low';
  avgIntentScore?: number;
}

interface NonBookingMissedOpportunitiesPanelProps {
  highReadinessCount: number;
  dateRange: string;
  missedOpportunities?: MissedOpportunity[];
  hotLeadsCount?: number;
}

const getUrgencyColor = (urgency?: string) => {
  switch (urgency) {
    case 'high': return 'bg-destructive text-destructive-foreground';
    case 'medium': return 'bg-amber-500 text-white';
    case 'low': return 'bg-secondary text-secondary-foreground';
    default: return 'bg-secondary text-secondary-foreground';
  }
};

export function NonBookingMissedOpportunitiesPanel({ 
  highReadinessCount,
  dateRange,
  missedOpportunities = [],
  hotLeadsCount = 0
}: NonBookingMissedOpportunitiesPanelProps) {
  const hasData = missedOpportunities.length > 0;

  const totalRecoverable = missedOpportunities.reduce((sum, mo) => sum + (mo.count || 0), 0);
  
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <UserX className="h-5 w-5 text-destructive" />
            Missed Opportunities
          </CardTitle>
          <Badge variant="destructive" className="text-xs">
            {highReadinessCount} high-readiness
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Members who engaged deeply but didn't book
        </p>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="space-y-4">
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-destructive/10 text-center">
                <p className="text-2xl font-bold text-destructive">{hotLeadsCount}</p>
                <p className="text-xs text-muted-foreground">🔥 Hot Leads</p>
              </div>
              <div className="p-3 rounded-lg bg-muted text-center">
                <p className="text-2xl font-bold text-orange-500">{highReadinessCount}</p>
                <p className="text-xs text-muted-foreground">High Readiness</p>
              </div>
              <div className="p-3 rounded-lg bg-muted text-center">
                <p className="text-2xl font-bold text-amber-500">{totalRecoverable}</p>
                <p className="text-xs text-muted-foreground">Recoverable</p>
              </div>
            </div>

            {/* Opportunity patterns */}
            <div className="space-y-3 max-h-[200px] overflow-y-auto">
              {missedOpportunities.map((opportunity, idx) => (
                <div 
                  key={idx}
                  className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1">
                      <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{opportunity.pattern}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {opportunity.count} members
                          </Badge>
                          {opportunity.urgency && (
                            <Badge className={`text-xs ${getUrgencyColor(opportunity.urgency)}`}>
                              {opportunity.urgency}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  {opportunity.recovery_suggestion && (
                    <div className="mt-2 flex items-start gap-2 pl-6">
                      <Lightbulb className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        {opportunity.recovery_suggestion}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
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
        )}
      </CardContent>
    </Card>
  );
}
