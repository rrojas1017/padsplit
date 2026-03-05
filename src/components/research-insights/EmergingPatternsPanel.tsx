import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp } from 'lucide-react';

interface EmergingPattern {
  pattern: string;
  evidence: string;
  frequency: number;
  watch_or_act: string;
}

interface EmergingPatternsPanelProps {
  data: EmergingPattern[];
}

const watchBadge = (level: string) => {
  if (level === 'act_now') return <Badge variant="destructive">Act Now</Badge>;
  if (level === 'investigate') return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">Investigate</Badge>;
  return <Badge variant="outline">Monitor</Badge>;
};

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
        {data.map((pattern, i) => (
          <div key={i} className="border border-border rounded-lg p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{pattern.pattern}</p>
              {watchBadge(pattern.watch_or_act)}
            </div>
            <p className="text-xs text-muted-foreground">{pattern.evidence}</p>
            <Badge variant="secondary">{pattern.frequency} cases</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
