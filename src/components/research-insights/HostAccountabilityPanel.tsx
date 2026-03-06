import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Home } from 'lucide-react';
import { PriorityBadge } from './PriorityBadge';

interface HostFlag {
  flag?: string;
  issue_pattern?: string;
  description?: string;
  priority?: string;
  quote?: string;
  recommendation?: string;
  // Legacy
  frequency?: number;
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

          return (
            <div key={i} className="border border-border rounded-lg p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{title}</p>
                <PriorityBadge priority={item.priority} />
              </div>

              {item.description && (
                <p className="text-xs text-muted-foreground">{item.description}</p>
              )}

              {item.quote && (
                <blockquote className="border-l-2 border-primary/40 pl-3 italic text-xs text-muted-foreground">
                  "{item.quote}"
                </blockquote>
              )}

              {(item.recommendation || item.recommended_enforcement) && (
                <div className="bg-muted/50 rounded p-2">
                  <p className="text-xs"><span className="font-medium text-foreground">Recommendation:</span> <span className="text-muted-foreground">{item.recommendation || item.recommended_enforcement}</span></p>
                </div>
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
