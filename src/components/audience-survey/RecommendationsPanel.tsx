import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AudienceRecommendation } from '@/types/research-insights';

interface Props {
  data: AudienceRecommendation[];
}

const PRIORITY_COLORS: Record<string, string> = {
  P0: 'bg-red-500/10 text-red-700 border-red-500/20',
  P1: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  P2: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
};

const EFFORT_COLORS: Record<string, string> = {
  low: 'bg-green-500/10 text-green-700',
  medium: 'bg-yellow-500/10 text-yellow-700',
  high: 'bg-red-500/10 text-red-700',
};

export function AudienceRecommendationsPanel({ data }: Props) {
  if (!data || data.length === 0) return null;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Marketing Recommendations</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((rec, i) => (
            <div key={i} className="rounded-lg border border-border p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-primary">#{rec.rank || i + 1}</span>
                  <h4 className="text-sm font-semibold text-foreground">{rec.recommendation}</h4>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {rec.priority && (
                    <Badge variant="outline" className={`text-xs ${PRIORITY_COLORS[rec.priority] || ''}`}>
                      {rec.priority}
                    </Badge>
                  )}
                  {rec.effort && (
                    <Badge variant="outline" className={`text-xs ${EFFORT_COLORS[rec.effort] || ''}`}>
                      {rec.effort}
                    </Badge>
                  )}
                </div>
              </div>
              {rec.rationale && (
                <p className="text-xs text-muted-foreground">{rec.rationale}</p>
              )}
              <div className="flex gap-4 text-xs text-muted-foreground">
                {rec.channel && <span><span className="font-medium">Channel:</span> {rec.channel}</span>}
                {rec.expected_impact && <span><span className="font-medium">Impact:</span> {rec.expected_impact}</span>}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
