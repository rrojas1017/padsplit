import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AudienceSegment } from '@/types/research-insights';

interface Props {
  data: AudienceSegment[];
}

const SEGMENT_LABELS: Record<string, string> = {
  social_media_heavy: 'Social Media Heavy',
  ad_responsive: 'Ad Responsive',
  word_of_mouth: 'Word of Mouth',
  price_driven: 'Price Driven',
  research_heavy: 'Research Heavy',
  passive_browser: 'Passive Browser',
};

const SEGMENT_BORDER_COLORS: string[] = [
  'border-l-indigo-500',
  'border-l-emerald-500',
  'border-l-rose-500',
  'border-l-amber-500',
  'border-l-sky-500',
  'border-l-violet-500',
];

const SEGMENT_BG_COLORS: string[] = [
  'bg-indigo-500/5',
  'bg-emerald-500/5',
  'bg-rose-500/5',
  'bg-amber-500/5',
  'bg-sky-500/5',
  'bg-violet-500/5',
];

export function AudienceSegmentsPanel({ data }: Props) {
  if (!data || data.length === 0) return null;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Audience Segments</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.map((seg, i) => (
            <div
              key={i}
              className={`rounded-lg border border-border border-l-4 ${SEGMENT_BORDER_COLORS[i % SEGMENT_BORDER_COLORS.length]} ${SEGMENT_BG_COLORS[i % SEGMENT_BG_COLORS.length]} p-4 space-y-3`}
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-foreground">
                  {SEGMENT_LABELS[seg.segment] || seg.segment.replace(/_/g, ' ')}
                </h4>
                <Badge variant="secondary" className="text-xs font-mono">
                  {seg.count} ({Math.round(seg.pct)}%)
                </Badge>
              </div>

              {seg.key_traits && seg.key_traits.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {seg.key_traits.map((trait, j) => (
                    <Badge key={j} variant="outline" className="text-[10px] px-1.5 py-0">{trait}</Badge>
                  ))}
                </div>
              )}

              {seg.best_channel && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Best Channel:</span> {seg.best_channel}
                </p>
              )}
              {seg.content_strategy && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Strategy:</span> {seg.content_strategy}
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
