import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EyeOff } from 'lucide-react';
import { PriorityBadge } from './PriorityBadge';

interface BlindSpot {
  blind_spot: string;
  how_discovered: string;
  estimated_prevalence: string;
  recommended_detection_method: string;
  priority: string;
}

interface BlindSpotsPanelProps {
  data: BlindSpot[];
}

export function BlindSpotsPanel({ data }: BlindSpotsPanelProps) {
  if (!data?.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <EyeOff className="w-4 h-4 text-amber-500" />
          Operational Blind Spots
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.map((spot, i) => (
          <div key={i} className="border border-border rounded-lg p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{spot.blind_spot}</p>
              <PriorityBadge priority={spot.priority} />
            </div>
            <p className="text-xs text-muted-foreground"><span className="font-medium">Discovered:</span> {spot.how_discovered}</p>
            <p className="text-xs text-muted-foreground"><span className="font-medium">Est. prevalence:</span> {spot.estimated_prevalence}</p>
            <div className="bg-muted/50 rounded p-2">
              <p className="text-xs text-foreground"><span className="font-medium">Detection method:</span> {spot.recommended_detection_method}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
