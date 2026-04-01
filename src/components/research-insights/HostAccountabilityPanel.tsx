import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Home } from 'lucide-react';
import { PriorityBadge } from './PriorityBadge';

interface HostFlag {
  flag?: string;
  severity?: string;
  [key: string]: any;
}

interface HostAccountabilityPanelProps {
  data: HostFlag[];
  maxVisible?: number;
}

function parseSeverity(sev: string): { priority: string; level: number; borderClass: string } {
  const lower = sev.toLowerCase();
  if (lower.includes('p0') || lower.includes('critical'))
    return { priority: 'P0', level: 0, borderClass: 'border-l-red-500' };
  if (lower.includes('p1') || lower.includes('high'))
    return { priority: 'P1', level: 1, borderClass: 'border-l-amber-500' };
  if (lower.includes('p2'))
    return { priority: 'P2', level: 2, borderClass: 'border-l-blue-500' };
  return { priority: '', level: 3, borderClass: 'border-l-muted-foreground/30' };
}

export function HostAccountabilityPanel({ data, maxVisible }: HostAccountabilityPanelProps) {
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo(() => {
    if (!data?.length) return [];
    return data.map(rawItem => {
      const item: HostFlag = typeof rawItem === 'string' ? { flag: rawItem, severity: '' } : rawItem;
      const sev = parseSeverity(item.severity || '');
      return { item, sev };
    }).sort((a, b) => a.sev.level - b.sev.level);
  }, [data]);

  if (!sorted.length) return null;

  const visible = maxVisible && !showAll ? sorted.slice(0, maxVisible) : sorted;

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
        {visible.map(({ item, sev }, i) => (
          <div
            key={i}
            className={`bg-card border border-border rounded-lg p-4 border-l-4 ${sev.borderClass} space-y-2`}
          >
            <div className="flex items-center gap-2">
              {sev.priority && <PriorityBadge priority={sev.priority} />}
              <span className="text-xs text-muted-foreground">{item.severity}</span>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{item.flag}</p>
          </div>
        ))}
        {maxVisible && sorted.length > maxVisible && !showAll && (
          <Button variant="ghost" size="sm" onClick={() => setShowAll(true)} className="w-full text-primary">
            Show all {sorted.length} flags
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
