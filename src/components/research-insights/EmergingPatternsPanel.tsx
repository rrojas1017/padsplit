import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, ChevronDown } from 'lucide-react';

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

/** Strip UUID references like ('895d29bc-3e6f-41b4-bc41-b58711d71cbb') from AI text */
function stripUUIDs(text: string): string {
  return text
    .replace(/\s*\(['"]?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}['"]?\)/gi, '')
    .replace(/\(['"]?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}['"]?\)/gi, '')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function getSeverityBadge(status?: string) {
  if (status === 'act_now') return <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">Act Now</Badge>;
  if (status === 'investigate') return <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">Investigate</Badge>;
  return <Badge className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800">Monitor</Badge>;
}

export function EmergingPatternsPanel({ data, maxVisible }: EmergingPatternsPanelProps) {
  const [showAll, setShowAll] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<Set<number>>(new Set());
  if (!data?.length) return null;

  const limit = maxVisible ?? 5;
  const visible = !showAll ? data.slice(0, limit) : data;
  const hasMore = data.length > limit;

  const toggleExpand = (idx: number) => {
    setExpandedIdx(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

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
          const rawDetail = item.evidence || item.description || '';
          const detail = stripUUIDs(rawDetail);
          const title = stripUUIDs(parsePattern(item.pattern).title);
          const fallbackDesc = stripUUIDs(parsePattern(item.pattern).description);
          const borderColor = getStatusBorderColor(item.watch_or_act);
          const isExpanded = expandedIdx.has(i);
          const displayDetail = detail || fallbackDesc;
          const isLong = displayDetail.length > 160;

          return (
            <div
              key={i}
              className="border border-border rounded-lg p-3 space-y-1.5"
              style={{ borderLeftWidth: '4px', borderLeftColor: borderColor }}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-foreground leading-snug flex-1">{title}</p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {item.frequency != null && (
                    <Badge variant="secondary" className="text-[10px]">{item.frequency} cases</Badge>
                  )}
                  {getSeverityBadge(item.watch_or_act)}
                </div>
              </div>
              {displayDetail && (
                <div>
                  <p className={`text-xs text-muted-foreground ${!isExpanded && isLong ? 'line-clamp-2' : ''}`}>
                    {displayDetail}
                  </p>
                  {isLong && (
                    <button
                      onClick={() => toggleExpand(i)}
                      className="text-xs text-primary hover:underline mt-0.5 flex items-center gap-0.5"
                    >
                      {isExpanded ? 'Show less' : 'Show more'}
                      <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {hasMore && !showAll && (
          <Button variant="outline" size="sm" onClick={() => setShowAll(true)} className="w-full">
            Show all {data.length} patterns
          </Button>
        )}
        {showAll && hasMore && (
          <Button variant="ghost" size="sm" onClick={() => setShowAll(false)} className="w-full text-muted-foreground">
            Collapse
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
