import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, ChevronDown } from 'lucide-react';
import { stripUUIDs, parseSeverityLevel } from './utils';
import type { EmergingPattern } from '@/types/research-insights';

interface MoveOutPatternsProps {
  data: EmergingPattern[];
}

function parsePatternTitle(text: string): { title: string; description: string } {
  // Handle markdown bold: **Title** description
  const match = text.match(/^\*\*([^*]+)\*\*\s*(.*)/s);
  if (match) return { title: match[1], description: match[2] };
  // Fallback: split on first period
  const dotIdx = text.indexOf('. ');
  if (dotIdx > 0 && dotIdx < 80) return { title: text.slice(0, dotIdx), description: text.slice(dotIdx + 2) };
  return { title: text, description: '' };
}

function getSeverityLabel(pattern: EmergingPattern): string {
  if (pattern.watch_or_act === 'act_now' || pattern.status === 'act_now') return 'Act Now';
  if (pattern.watch_or_act === 'investigate' || pattern.status === 'investigate') return 'Investigate';
  return 'Monitor';
}

export function MoveOutPatterns({ data }: MoveOutPatternsProps) {
  const [showAll, setShowAll] = useState(false);

  if (!data?.length) return null;

  // Sort by frequency/case count desc
  const sorted = [...data].sort((a, b) => (b.frequency || 0) - (a.frequency || 0));
  const visible = showAll ? sorted : sorted.slice(0, 5);

  return (
    <Card className="shadow-sm rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          Emerging Patterns
          <Badge variant="secondary" className="ml-auto text-xs">{data.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {visible.map((pattern, i) => (
          <PatternCard key={i} pattern={pattern} />
        ))}
        {data.length > 5 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(!showAll)}
            className="w-full text-xs mt-2"
          >
            {showAll ? 'Show fewer' : `Show all ${data.length} patterns`}
            <ChevronDown className={`w-3.5 h-3.5 ml-1 transition-transform ${showAll ? 'rotate-180' : ''}`} />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function PatternCard({ pattern }: { pattern: EmergingPattern }) {
  const [expanded, setExpanded] = useState(false);
  const { title, description: parsedDesc } = parsePatternTitle(stripUUIDs(pattern.pattern));
  const fullDescription = stripUUIDs(pattern.description || parsedDesc || '');
  const severityLabel = getSeverityLabel(pattern);
  const { borderClass, bgClass, textClass } = parseSeverityLevel(severityLabel);

  return (
    <div className={`rounded-lg border border-l-4 ${borderClass} p-4 bg-card`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-foreground truncate">{stripUUIDs(title)}</p>
          {fullDescription && (
            <p className={`text-sm text-muted-foreground mt-1 leading-relaxed ${!expanded ? 'line-clamp-2' : ''}`}>
              {fullDescription}
            </p>
          )}
          {fullDescription && fullDescription.length > 120 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-primary mt-1 hover:underline"
            >
              {expanded ? 'Show less' : 'Show details'}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {pattern.frequency && pattern.frequency > 0 && (
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
              {pattern.frequency} cases
            </span>
          )}
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${bgClass} ${textClass}`}>
            {severityLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
