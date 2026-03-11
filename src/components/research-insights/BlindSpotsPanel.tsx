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
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-amber-500/10 flex items-center justify-center">
            <EyeOff className="w-4 h-4 text-amber-500" />
          </div>
          Operational Blind Spots
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.map((rawSpot, i) => {
          const spot: BlindSpot = typeof rawSpot === 'string' ? { blind_spot: rawSpot } : rawSpot;
          return (
          <div
            key={i}
            className="border border-border rounded-lg p-4 space-y-1 hover:bg-amber-500/5 transition-colors"
            style={{ borderLeftWidth: '4px', borderLeftColor: 'hsl(45, 93%, 47%)' }}
          >
            <div className="flex items-start gap-2">
              <span className="text-xs font-bold text-amber-600 bg-amber-500/10 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
              <div>
                <p className="text-sm font-medium text-foreground">{spot.blind_spot}</p>
                {spot.description && (
                  <p className="text-xs text-muted-foreground mt-1">{spot.description}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
