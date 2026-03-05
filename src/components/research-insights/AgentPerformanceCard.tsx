import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserCheck } from 'lucide-react';

interface AgentPerformanceProps {
  data: {
    total_calls_reviewed: number;
    avg_questions_covered: number;
    coverage_pct: number;
    commonly_skipped_sections: Array<{ section: string; skip_frequency: number; impact: string }>;
    positive_patterns: string[];
    coaching_opportunities: Array<{ issue: string; frequency: number; recommendation: string }>;
  };
}

export function AgentPerformanceCard({ data }: AgentPerformanceProps) {
  if (!data) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-emerald-500" />
          Agent Performance Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-lg font-bold text-foreground">{data.total_calls_reviewed}</p>
            <p className="text-xs text-muted-foreground">Calls Reviewed</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-lg font-bold text-foreground">{data.avg_questions_covered?.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">Avg Questions</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-lg font-bold text-foreground">{data.coverage_pct?.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground">Coverage</p>
          </div>
        </div>

        {data.positive_patterns?.length > 0 && (
          <div>
            <p className="text-xs font-medium text-foreground mb-1">Positive Patterns</p>
            <div className="flex gap-1.5 flex-wrap">
              {data.positive_patterns.map((p, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{p}</Badge>
              ))}
            </div>
          </div>
        )}

        {data.commonly_skipped_sections?.length > 0 && (
          <div>
            <p className="text-xs font-medium text-foreground mb-2">Commonly Skipped Sections</p>
            <div className="space-y-2">
              {data.commonly_skipped_sections.map((s, i) => (
                <div key={i} className="text-xs border border-border rounded p-2">
                  <div className="flex justify-between">
                    <span className="font-medium text-foreground">{s.section}</span>
                    <Badge variant="outline">{s.skip_frequency}x</Badge>
                  </div>
                  <p className="text-muted-foreground mt-1">{s.impact}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.coaching_opportunities?.length > 0 && (
          <div>
            <p className="text-xs font-medium text-foreground mb-2">Coaching Opportunities</p>
            <div className="space-y-2">
              {data.coaching_opportunities.map((c, i) => (
                <div key={i} className="bg-amber-500/5 border border-amber-500/20 rounded p-2 text-xs">
                  <p className="font-medium text-foreground">{c.issue} ({c.frequency}x)</p>
                  <p className="text-muted-foreground mt-0.5">{c.recommendation}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
