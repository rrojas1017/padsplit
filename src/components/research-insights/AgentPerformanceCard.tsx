import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserCheck, ThumbsUp, AlertTriangle, Lightbulb } from 'lucide-react';

interface AgentPerformanceProps {
  data: {
    // New narrative format
    strengths?: string;
    weaknesses?: string[];
    recommendation?: string;
    // Legacy format
    total_calls_reviewed?: number;
    avg_questions_covered?: number;
    coverage_pct?: number;
    commonly_skipped_sections?: Array<{ section: string; skip_frequency: number; impact: string }>;
    positive_patterns?: string[];
    coaching_opportunities?: Array<{ issue: string; frequency: number; recommendation: string }>;
  };
}

export function AgentPerformanceCard({ data }: AgentPerformanceProps) {
  if (!data) return null;

  const isNarrative = !!(data.strengths || data.weaknesses);

  if (isNarrative) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-500" />
            Agent Performance Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.strengths && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <ThumbsUp className="w-4 h-4 text-emerald-500" />
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Strengths</p>
              </div>
              <p className="text-sm text-muted-foreground">{data.strengths}</p>
            </div>
          )}

          {data.weaknesses?.length ? (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Weaknesses & Gaps</p>
              </div>
              <ul className="space-y-2">
                {data.weaknesses.map((w, i) => (
                  <li key={i} className="text-sm text-muted-foreground border border-border rounded-lg p-3">
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {data.recommendation && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-primary" />
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Recommendation</p>
              </div>
              <p className="text-sm text-foreground">{data.recommendation}</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Legacy stat-based layout
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

        {data.positive_patterns?.length ? (
          <div>
            <p className="text-xs font-medium text-foreground mb-1">Positive Patterns</p>
            <div className="flex gap-1.5 flex-wrap">
              {data.positive_patterns.map((p, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{p}</Badge>
              ))}
            </div>
          </div>
        ) : null}

        {data.coaching_opportunities?.length ? (
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
        ) : null}
      </CardContent>
    </Card>
  );
}
