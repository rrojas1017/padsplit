import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRightLeft } from 'lucide-react';

interface TransferFrictionProps {
  data: {
    summary?: string;
    recommendations?: string[];
    issues_identified?: string[];
    // Legacy fields
    key_friction_points?: any[];
    key_failures?: string[];
    recommendation?: string;
    friction_points?: any[];
  };
}

export function TransferFrictionCard({ data }: TransferFrictionProps) {
  if (!data) return null;

  const issues = data.issues_identified || data.key_failures || [];
  const recommendations = data.recommendations || (data.recommendation ? [data.recommendation] : []);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-violet-500/10 flex items-center justify-center">
            <ArrowRightLeft className="w-4 h-4 text-violet-500" />
          </div>
          Transfer Friction Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.summary && (
          <p className="text-sm text-muted-foreground leading-relaxed">{data.summary}</p>
        )}

        {issues.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wide">Issues Identified</p>
            <ul className="space-y-1.5">
              {issues.map((issue, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-2 flex-shrink-0" />
                  <span className="text-muted-foreground">{typeof issue === 'string' ? issue : (issue as any).point || JSON.stringify(issue)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {recommendations.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wide">Recommendations</p>
            <ol className="space-y-1.5 list-decimal list-inside">
              {recommendations.map((rec, i) => (
                <li key={i} className="text-sm text-muted-foreground">{rec}</li>
              ))}
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
