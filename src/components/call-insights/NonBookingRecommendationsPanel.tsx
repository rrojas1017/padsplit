import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, Target, Users, PhoneOff, Sparkles } from 'lucide-react';

interface Recommendation {
  recommendation: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  expected_impact: string;
}

interface RecoveryPattern {
  pattern: string;
  frequency: number;
  suggestion: string;
}

interface NonBookingRecommendationsPanelProps {
  recommendations?: Recommendation[];
  recoveryPatterns?: RecoveryPattern[];
}

const getPriorityColor = (priority: string) => {
  const lower = priority.toLowerCase();
  if (lower === 'high') return 'bg-destructive text-destructive-foreground';
  if (lower === 'medium') return 'bg-amber-500 text-white';
  return 'bg-secondary text-secondary-foreground';
};

export function NonBookingRecommendationsPanel({ 
  recommendations = [], 
  recoveryPatterns = [] 
}: NonBookingRecommendationsPanelProps) {
  const hasData = recommendations.length > 0 || recoveryPatterns.length > 0;

  if (!hasData) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recovery Recommendations Placeholder */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              Recovery Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="p-4 rounded-full bg-amber-500/10 mb-4">
                <Sparkles className="h-8 w-8 text-amber-500" />
              </div>
              <h4 className="font-medium mb-2">AI Recommendations Coming Soon</h4>
              <p className="text-sm text-muted-foreground max-w-[360px]">
                Run analysis to get personalized recommendations for recovering missed opportunities and reducing non-booking rates
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Recovery Patterns Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PhoneOff className="h-5 w-5 text-destructive" />
              Common Blockers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="p-3 rounded-full bg-muted mb-4">
                <Target className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Patterns will appear after AI analysis
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* AI Recommendations */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            Recovery Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recommendations.map((rec, idx) => (
              <div 
                key={idx} 
                className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 mt-0.5">
                      <Target className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{rec.recommendation}</p>
                      {rec.expected_impact && (
                        <p className="text-xs text-muted-foreground mt-1">
                          <span className="font-medium">Impact:</span> {rec.expected_impact}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <Badge className={getPriorityColor(rec.priority)}>
                      {rec.priority}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {rec.category}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recovery Patterns */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PhoneOff className="h-5 w-5 text-destructive" />
            Common Blockers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recoveryPatterns.map((pattern, idx) => (
              <div 
                key={idx}
                className="p-3 rounded-lg bg-muted/50 border"
              >
                <p className="text-sm font-medium">{pattern.pattern}</p>
                {pattern.frequency > 0 && (
                  <Badge variant="secondary" className="mt-2 text-xs">
                    {pattern.frequency}% of non-bookers
                  </Badge>
                )}
                {pattern.suggestion && (
                  <p className="text-xs text-muted-foreground mt-2">
                    <span className="font-medium">Suggestion:</span> {pattern.suggestion}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
