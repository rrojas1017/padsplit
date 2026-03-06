import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Home } from 'lucide-react';
import { PriorityBadge } from './PriorityBadge';

interface HostFlag {
  // New format
  flag?: string;
  description?: string;
  quote?: string;
  recommendation?: string;
  // Legacy format
  issue_pattern?: string;
  frequency?: number;
  impact_on_retention?: string;
  impact_on_legal_risk?: string;
  recommended_enforcement?: string;
  systemic_fix?: string;
}

interface HostAccountabilityPanelProps {
  data: HostFlag[];
}

export function HostAccountabilityPanel({ data }: HostAccountabilityPanelProps) {
  if (!data?.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Home className="w-4 h-4 text-orange-500" />
          Host Accountability Flags
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.map((item, i) => {
          const title = item.flag || item.issue_pattern;
          const isP0 = title?.toLowerCase().includes('p0');

          return (
            <div key={i} className={`border rounded-lg p-4 space-y-3 ${isP0 ? 'border-destructive/30 bg-destructive/5' : 'border-border'}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{title}</p>
                {isP0 ? (
                  <Badge variant="destructive">P0</Badge>
                ) : item.frequency != null ? (
                  <Badge variant="secondary">{item.frequency} cases</Badge>
                ) : null}
              </div>

              {item.description && (
                <p className="text-xs text-muted-foreground">{item.description}</p>
              )}

              {item.quote && (
                <blockquote className="border-l-2 border-primary/40 pl-3 italic text-xs text-muted-foreground">
                  "{item.quote}"
                </blockquote>
              )}

              {item.recommendation && (
                <div className="bg-muted/50 rounded p-2">
                  <p className="text-xs"><span className="font-medium text-foreground">Recommendation:</span> <span className="text-muted-foreground">{item.recommendation}</span></p>
                </div>
              )}

              {item.recommended_enforcement && (
                <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Enforcement:</span> {item.recommended_enforcement}</p>
              )}

              {item.systemic_fix && (
                <div className="bg-muted/50 rounded p-2">
                  <p className="text-xs"><span className="font-medium text-foreground">Systemic fix:</span> <span className="text-muted-foreground">{item.systemic_fix}</span></p>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
