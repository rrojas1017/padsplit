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

export function AudienceSegmentsPanel({ data }: Props) {
  if (!data || data.length === 0) return null;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Audience Segments</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((seg, i) => (
            <div key={i} className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-foreground">
                  {SEGMENT_LABELS[seg.segment] || seg.segment.replace(/_/g, ' ')}
                </h4>
                <Badge variant="secondary" className="text-xs">
                  {seg.count} ({Math.round(seg.pct)}%)
                </Badge>
              </div>

              {seg.key_traits && seg.key_traits.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {seg.key_traits.map((trait, j) => (
                    <Badge key={j} variant="outline" className="text-xs">{trait}</Badge>
                  ))}
                </div>
              )}

              {seg.best_channel && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Best Channel:</span> {seg.best_channel}
                </p>
              )}
              {seg.content_strategy && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Strategy:</span> {seg.content_strategy}
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
