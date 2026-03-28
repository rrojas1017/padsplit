import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  maxVisible?: number;
}

function getStatusBorderColor(status?: string): string {
  if (status === 'act_now') return 'hsl(var(--destructive))';
  if (status === 'investigate') return 'hsl(45, 93%, 47%)';
  return 'hsl(var(--border))';
}

function parsePattern(text: string): { title: string; description: string } {
  const match = text.match(/^\*\*([^*]+)\*\*\s*(.*)/s);
  if (match) return { title: match[1], description: match[2] };
  const dotIdx = text.indexOf('. ');
  if (dotIdx > 0 && dotIdx < 80) return { title: text.slice(0, dotIdx + 1), description: text.slice(dotIdx + 2) };
  if (text.length > 60) return { title: text.slice(0, 60) + '…', description: text };
  return { title: text, description: '' };
}

export function EmergingPatternsPanel({ data, maxVisible }: EmergingPatternsPanelProps) {
  const [showAll, setShowAll] = useState(false);
  if (!data?.length) return null;

  const visible = maxVisible && !showAll ? data.slice(0, maxVisible) : data;
  const hasMore = maxVisible != null && data.length > maxVisible;

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-violet-500/10 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-violet-500" />
          </div>
          Emerging Patterns
          <Badge variant="secondary" className="ml-auto">{data.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {visible.map((rawItem, i) => {
          const item: EmergingPattern = typeof rawItem === 'string' ? { pattern: rawItem } : rawItem;
          const detail = item.evidence || item.description;
          const borderColor = getStatusBorderColor(item.watch_or_act);

          return (
            <div
              key={i}
              className="border border-border rounded-lg p-4 space-y-2"
              style={{ borderLeftWidth: '4px', borderLeftColor: borderColor }}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{parsePattern(item.pattern).title}</p>
                {item.watch_or_act && (
                  item.watch_or_act === 'act_now'
                    ? <Badge variant="destructive">Act Now</Badge>
                    : item.watch_or_act === 'investigate'
                    ? <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">Investigate</Badge>
                    : <Badge variant="outline">Monitor</Badge>
                )}
              </div>
              {(detail || parsePattern(item.pattern).description) && (
                <p className="text-xs text-muted-foreground line-clamp-2">{detail || parsePattern(item.pattern).description}</p>
              )}
              {item.quote && (
                <blockquote className="border-l-2 border-accent pl-3 italic text-xs text-muted-foreground">
                  "{item.quote}"
                </blockquote>
              )}
              {item.frequency != null && (
                <Badge variant="secondary">{item.frequency} cases</Badge>
              )}
            </div>
          );
        })}
        {hasMore && !showAll && (
          <Button variant="ghost" size="sm" onClick={() => setShowAll(true)} className="w-full text-primary">
            Show all {data.length} patterns
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
