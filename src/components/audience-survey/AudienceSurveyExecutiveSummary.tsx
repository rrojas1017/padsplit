import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AudienceSurveySummary } from '@/types/research-insights';

interface Props {
  data: AudienceSurveySummary;
}

export function AudienceSurveyExecutiveSummary({ data }: Props) {
  return (
    <Card className="border-primary/20 shadow-sm">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <Badge variant="outline" className="text-xs">Executive Summary</Badge>
            <h3 className="text-lg font-semibold text-foreground">{data.headline || 'Audience Survey Results'}</h3>
          </div>
          <Badge className="bg-primary/10 text-primary border-primary/20">
            {data.total_responses || 0} responses
          </Badge>
        </div>

        {data.key_findings && data.key_findings.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Key Findings</p>
            <ul className="space-y-1.5">
              {data.key_findings.map((finding, i) => (
                <li key={i} className="text-sm text-foreground flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{typeof finding === 'string' ? finding : JSON.stringify(finding)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
