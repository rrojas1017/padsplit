import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp } from 'lucide-react';

interface EmergingPattern {
  pattern: string;
  evidence?: string;
  description?: string;
  quote?: string;
  frequency?: number;
  watch_or_act?: string;
}

interface EmergingPatternsPanelProps {
  data: EmergingPattern[];
}

export function EmergingPatternsPanel({ data }: EmergingPatternsPanelProps) {
  if (!data?.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-violet-500" />
          Emerging Patterns
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.map((item, i) => {
          const detail = item.evidence || item.description;

          return (
            <div key={i} className="border border-border rounded-lg p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{item.pattern}</p>
                {item.watch_or_act && (
                  item.watch_or_act === 'act_now'
                    ? <Badge variant="destructive">Act Now</Badge>
                    : item.watch_or_act === 'investigate'
                    ? <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">Investigate</Badge>
                    : <Badge variant="outline">Monitor</Badge>
                )}
              </div>
              {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
              {item.quote && (
                <blockquote className="border-l-2 border-primary/40 pl-3 italic text-xs text-muted-foreground">
                  "{item.quote}"
                </blockquote>
              )}
              {item.frequency != null && (
                <Badge variant="secondary">{item.frequency} cases</Badge>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
