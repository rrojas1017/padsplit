import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserCheck, ThumbsUp, AlertTriangle, Lightbulb } from 'lucide-react';

interface OpportunityItem {
  area: string;
  description?: string;
  recommendation?: string;
}

interface AgentPerformanceProps {
  data: {
    strengths?: string;
    opportunities_for_improvement?: OpportunityItem[];
    weaknesses?: string[];
    recommendation?: string;
    total_calls_reviewed?: number;
    avg_questions_covered?: number;
    coverage_pct?: number;
    positive_patterns?: string[];
    coaching_opportunities?: Array<{ issue: string; frequency: number; recommendation: string }>;
  };
}

export function AgentPerformanceCard({ data }: AgentPerformanceProps) {
  if (!data) return null;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <UserCheck className="w-4 h-4 text-emerald-500" />
          </div>
          Agent Performance Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.strengths && (
          <div className="bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <ThumbsUp className="w-4 h-4 text-emerald-500" />
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Strengths</p>
            </div>
            <p className="text-sm text-muted-foreground">{data.strengths}</p>
          </div>
        )}

        {data.opportunities_for_improvement?.length ? (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Opportunities for Improvement</p>
            </div>
            <div className="space-y-3">
              {data.opportunities_for_improvement.map((opp, i) => (
                <div
                  key={i}
                  className="border border-border rounded-lg p-3 space-y-2"
                  style={{ borderLeftWidth: '4px', borderLeftColor: 'hsl(45, 93%, 47%)' }}
                >
                  <p className="text-sm font-medium text-foreground">{opp.area}</p>
                  {opp.description && <p className="text-xs text-muted-foreground">{opp.description}</p>}
                  {opp.recommendation && (
                    <div className="flex items-start gap-1.5">
                      <Lightbulb className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-foreground">{opp.recommendation}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : data.weaknesses?.length ? (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Weaknesses & Gaps</p>
            </div>
            <ul className="space-y-2">
              {data.weaknesses.map((w, i) => (
                <li key={i} className="text-sm text-muted-foreground border border-border rounded-lg p-3">{w}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {data.recommendation && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-4 h-4 text-primary" />
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Recommendation</p>
            </div>
            <p className="text-sm text-foreground">{data.recommendation}</p>
          </div>
        )}

        {data.total_calls_reviewed != null && (
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-xl bg-gradient-to-br from-muted/30 to-muted/60 border border-border">
              <p className="text-lg font-bold text-foreground">{data.total_calls_reviewed}</p>
              <p className="text-xs text-muted-foreground">Calls Reviewed</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-gradient-to-br from-muted/30 to-muted/60 border border-border">
              <p className="text-lg font-bold text-foreground">{data.avg_questions_covered?.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground">Avg Questions</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-gradient-to-br from-muted/30 to-muted/60 border border-border">
              <p className="text-lg font-bold text-foreground">{data.coverage_pct?.toFixed(0)}%</p>
              <p className="text-xs text-muted-foreground">Coverage</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
