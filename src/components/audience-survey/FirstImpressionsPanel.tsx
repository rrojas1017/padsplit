import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { FirstImpressionsData } from '@/types/research-insights';
import { RankedItemsTable } from './RankedItemsTable';

interface Props {
  data: FirstImpressionsData;
}

export function FirstImpressionsPanel({ data }: Props) {
  const impressionDist = data.impression_distribution;
  const total = impressionDist
    ? (impressionDist.positive + impressionDist.neutral + impressionDist.negative + impressionDist.mixed)
    : 0;

  return (
    <div className="space-y-6">
      {impressionDist && total > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">First Impression Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 flex-wrap">
              {[
                { label: 'Positive', value: impressionDist.positive, color: 'bg-green-500' },
                { label: 'Neutral', value: impressionDist.neutral, color: 'bg-yellow-500' },
                { label: 'Negative', value: impressionDist.negative, color: 'bg-red-500' },
                { label: 'Mixed', value: impressionDist.mixed, color: 'bg-blue-500' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${item.color}`} />
                  <span className="text-sm text-foreground">{item.label}: {item.value} ({Math.round((item.value / total) * 100)}%)</span>
                </div>
              ))}
            </div>
            <div className="h-3 flex rounded-full overflow-hidden mt-3">
              <div className="bg-green-500" style={{ width: `${(impressionDist.positive / total) * 100}%` }} />
              <div className="bg-yellow-500" style={{ width: `${(impressionDist.neutral / total) * 100}%` }} />
              <div className="bg-red-500" style={{ width: `${(impressionDist.negative / total) * 100}%` }} />
              <div className="bg-blue-500" style={{ width: `${(impressionDist.mixed / total) * 100}%` }} />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Concerns</CardTitle>
          </CardHeader>
          <CardContent>
            <RankedItemsTable
              items={(data.top_concerns || []).map(i => ({ label: i.concern, count: i.count }))}
            />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Interest Drivers</CardTitle>
          </CardHeader>
          <CardContent>
            <RankedItemsTable
              items={(data.top_interest_drivers || []).map(i => ({ label: i.driver, count: i.count }))}
            />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Confusion Points</CardTitle>
          </CardHeader>
          <CardContent>
            <RankedItemsTable
              items={(data.confusion_points || []).map(i => ({ label: i.point, count: i.count }))}
            />
          </CardContent>
        </Card>
      </div>

      {data.discovery_channels && data.discovery_channels.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">How They Heard About PadSplit</CardTitle>
          </CardHeader>
          <CardContent>
            <RankedItemsTable
              items={data.discovery_channels.map(i => ({ label: i.channel, count: i.count }))}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
