import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Home } from 'lucide-react';
import { PriorityBadge } from './PriorityBadge';

interface HostFlag {
  flag?: string;
  issue_pattern?: string;
  description?: string;
  priority?: string;
  quote?: string;
  recommendation?: string;
  frequency?: number;
  recommended_enforcement?: string;
  systemic_fix?: string;
}

interface HostAccountabilityPanelProps {
  data: HostFlag[];
  maxVisible?: number;
}

function getPriorityBorderColor(priority?: string): string {
  if (!priority) return 'hsl(var(--border))';
  const p = priority.toUpperCase();
  if (p.includes('P0')) return 'hsl(var(--destructive))';
  if (p.includes('P1')) return 'hsl(45, 93%, 47%)';
  if (p.includes('P2')) return 'hsl(217, 91%, 60%)';
  return 'hsl(var(--border))';
}

export function HostAccountabilityPanel({ data, maxVisible }: HostAccountabilityPanelProps) {
  const [showAll, setShowAll] = useState(false);
  if (!data?.length) return null;

  const visible = maxVisible && !showAll ? data.slice(0, maxVisible) : data;
  const hasMore = maxVisible != null && data.length > maxVisible;

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-orange-500/10 flex items-center justify-center">
            <Home className="w-4 h-4 text-orange-500" />
          </div>
          Host Accountability Flags
          <Badge variant="secondary" className="ml-auto">{data.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {visible.map((rawItem, i) => {
          const item: HostFlag = typeof rawItem === 'string' ? { flag: rawItem } : rawItem;
          const title = item.flag || item.issue_pattern;
          const borderColor = getPriorityBorderColor(item.priority);

          return (
            <div
              key={i}
              className="border border-border rounded-lg p-4 space-y-2"
              style={{ borderLeftWidth: '4px', borderLeftColor: borderColor }}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{title}</p>
                <PriorityBadge priority={item.priority} />
              </div>

              {item.description && (
                <p className="text-xs text-muted-foreground">{item.description}</p>
              )}

              {item.quote && (
                <blockquote className="border-l-2 border-accent pl-3 italic text-xs text-muted-foreground">
                  "{item.quote}"
                </blockquote>
              )}

              {(item.recommendation || item.recommended_enforcement) && (
                <div className="bg-muted/40 rounded-lg p-2">
                  <p className="text-xs"><span className="font-medium text-foreground">Recommendation:</span> <span className="text-muted-foreground">{item.recommendation || item.recommended_enforcement}</span></p>
                </div>
              )}

              {item.systemic_fix && (
                <div className="bg-muted/40 rounded-lg p-2">
                  <p className="text-xs"><span className="font-medium text-foreground">Systemic fix:</span> <span className="text-muted-foreground">{item.systemic_fix}</span></p>
                </div>
              )}
            </div>
          );
        })}
        {hasMore && !showAll && (
          <Button variant="ghost" size="sm" onClick={() => setShowAll(true)} className="w-full text-primary">
            Show all {data.length} flags
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
