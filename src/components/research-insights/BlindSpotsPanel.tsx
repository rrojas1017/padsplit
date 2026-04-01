import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface BlindSpot {
  blind_spot: string;
  description?: string;
}

interface BlindSpotsPanelProps {
  data: BlindSpot[];
  maxVisible?: number;
}

export function BlindSpotsPanel({ data, maxVisible }: BlindSpotsPanelProps) {
  const [showAll, setShowAll] = useState(false);
  if (!data?.length) return null;

  const visible = maxVisible && !showAll ? data.slice(0, maxVisible) : data;
  const hasMore = maxVisible != null && data.length > maxVisible;

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-amber-500/10 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          Operational Blind Spots
          <Badge variant="secondary" className="ml-auto">{data.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {visible.map((rawSpot, i) => {
          const spot: BlindSpot = typeof rawSpot === 'string' ? { blind_spot: rawSpot } : rawSpot;
          return (
            <div
              key={i}
              className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3"
            >
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">{spot.blind_spot}</p>
                {spot.description && (
                  <p className="text-xs text-muted-foreground mt-1">{spot.description}</p>
                )}
              </div>
            </div>
          );
        })}
        {hasMore && !showAll && (
          <Button variant="ghost" size="sm" onClick={() => setShowAll(true)} className="w-full text-primary">
            Show all {data.length} blind spots
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
