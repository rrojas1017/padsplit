import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Palette, Target, MessageSquare, Share2, Lightbulb } from 'lucide-react';
import type { AudienceRecommendation } from '@/types/research-insights';

interface Props {
  data: AudienceRecommendation[];
}

const PRIORITY_STYLES: Record<string, string> = {
  P0: 'bg-red-500/10 text-red-700 border-red-500/20',
  P1: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  P2: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  high: 'bg-red-500/10 text-red-700 border-red-500/20',
  medium: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  low: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
};

const CATEGORY_ICONS: Record<string, typeof Palette> = {
  creative: Palette,
  targeting: Target,
  messaging: MessageSquare,
  channel: Share2,
};

const CATEGORY_COLORS: Record<string, string> = {
  creative: 'bg-violet-500/10 text-violet-700',
  targeting: 'bg-sky-500/10 text-sky-700',
  messaging: 'bg-emerald-500/10 text-emerald-700',
  channel: 'bg-orange-500/10 text-orange-700',
};

export function AudienceRecommendationsPanel({ data }: Props) {
  if (!data || data.length === 0) return null;

  // Sort by priority: P0/high first
  const priorityOrder: Record<string, number> = { P0: 0, high: 0, P1: 1, medium: 1, P2: 2, low: 2 };
  const sorted = [...data].sort((a, b) =>
    (priorityOrder[a.priority || ''] ?? 3) - (priorityOrder[b.priority || ''] ?? 3)
  );

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Marketing Recommendations</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sorted.map((rec, i) => {
            const category = rec.channel?.toLowerCase() || '';
            const CategoryIcon = CATEGORY_ICONS[category] || Lightbulb;
            const categoryColor = CATEGORY_COLORS[category] || 'bg-gray-500/10 text-gray-700';

            return (
              <div key={i} className="rounded-lg border border-border p-4 space-y-2 hover:bg-muted/30 transition-colors">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${categoryColor}`}>
                    <CategoryIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-semibold text-foreground">{rec.recommendation}</h4>
                      <div className="flex gap-1 flex-shrink-0">
                        {rec.priority && (
                          <Badge variant="outline" className={`text-[10px] ${PRIORITY_STYLES[rec.priority] || ''}`}>
                            {rec.priority}
                          </Badge>
                        )}
                        {rec.channel && (
                          <Badge variant="outline" className={`text-[10px] ${categoryColor}`}>
                            {rec.channel}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {rec.rationale && (
                      <p className="text-xs text-muted-foreground mt-1">{rec.rationale}</p>
                    )}
                    {rec.expected_impact && (
                      <p className="text-xs text-muted-foreground mt-1">
                        <span className="font-medium text-foreground">Expected Impact:</span> {rec.expected_impact}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
