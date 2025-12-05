import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, Target, Users, Megaphone, GraduationCap, Settings } from 'lucide-react';

interface Recommendation {
  recommendation: string;
  category: string;
  priority: string;
  expected_impact: string;
}

interface JourneyInsight {
  pattern: string;
  frequency: number;
  implication: string;
}

interface RecommendationsPanelProps {
  recommendations: Recommendation[];
  journeyInsights: JourneyInsight[];
}

const getCategoryIcon = (category: string) => {
  const lower = category.toLowerCase();
  if (lower.includes('marketing')) return <Megaphone className="h-4 w-4" />;
  if (lower.includes('retention')) return <Users className="h-4 w-4" />;
  if (lower.includes('training')) return <GraduationCap className="h-4 w-4" />;
  if (lower.includes('operations')) return <Settings className="h-4 w-4" />;
  return <Target className="h-4 w-4" />;
};

const getPriorityColor = (priority: string) => {
  const lower = priority.toLowerCase();
  if (lower === 'high') return 'bg-destructive text-destructive-foreground';
  if (lower === 'medium') return 'bg-amber-500 text-white';
  return 'bg-secondary text-secondary-foreground';
};

const RecommendationsPanel = ({ recommendations, journeyInsights }: RecommendationsPanelProps) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* AI Recommendations */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            AI Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recommendations.length > 0 ? (
            <div className="space-y-4">
              {recommendations.map((rec, idx) => (
                <div 
                  key={idx} 
                  className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary mt-0.5">
                        {getCategoryIcon(rec.category)}
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
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Lightbulb className="h-10 w-10 mb-2 opacity-50" />
              <p>No recommendations generated yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Member Journey Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-500" />
            Journey Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          {journeyInsights.length > 0 ? (
            <div className="space-y-4">
              {journeyInsights.map((insight, idx) => (
                <div 
                  key={idx}
                  className="p-3 rounded-lg bg-muted/50 border"
                >
                  <p className="text-sm font-medium">{insight.pattern}</p>
                  {insight.frequency > 0 && (
                    <Badge variant="secondary" className="mt-2 text-xs">
                      {insight.frequency}% of members
                    </Badge>
                  )}
                  {insight.implication && (
                    <p className="text-xs text-muted-foreground mt-2">
                      <span className="font-medium">Implication:</span> {insight.implication}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Users className="h-10 w-10 mb-2 opacity-50" />
              <p className="text-sm text-center">No journey patterns identified</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RecommendationsPanel;