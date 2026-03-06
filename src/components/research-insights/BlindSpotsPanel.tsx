import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EyeOff } from 'lucide-react';

interface BlindSpot {
  blind_spot: string;
  description?: string;
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
          <div key={i} className="border border-border rounded-lg p-4 space-y-1">
            <p className="text-sm font-medium text-foreground">{spot.blind_spot}</p>
            {spot.description && (
              <p className="text-xs text-muted-foreground">{spot.description}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
