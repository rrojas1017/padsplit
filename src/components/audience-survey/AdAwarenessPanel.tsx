import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { AdAwarenessData } from '@/types/research-insights';
import { RankedItemsTable } from './RankedItemsTable';

interface Props {
  data: AdAwarenessData;
}

export function AdAwarenessPanel({ data }: Props) {
  const pieData = [
    { name: 'Seen PadSplit Ads', value: data.seen_padsplit_ads_pct || 0 },
    { name: 'Not Seen', value: 100 - (data.seen_padsplit_ads_pct || 0) },
  ];
  const COLORS = ['hsl(var(--primary))', 'hsl(var(--muted))'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">PadSplit Ad Awareness</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${Math.round(value)}%`}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {data.where_seen_padsplit && data.where_seen_padsplit.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-muted-foreground mb-2">Where They've Seen PadSplit Ads</p>
              <div className="flex flex-wrap gap-2">
                {data.where_seen_padsplit.map((item) => (
                  <Badge key={item.platform} variant="secondary">{item.platform} ({item.count})</Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Where They'd Expect PadSplit Ads</CardTitle>
        </CardHeader>
        <CardContent>
          {data.where_expected_padsplit && data.where_expected_padsplit.length > 0 ? (
            <RankedItemsTable
              items={data.where_expected_padsplit.map(i => ({ label: i.platform, count: i.count }))}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No data available</p>
          )}
          {data.top_standout_companies && data.top_standout_companies.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-muted-foreground mb-2">Standout Ad Companies</p>
              <RankedItemsTable
                items={data.top_standout_companies.map(i => ({ label: i.company, count: i.count }))}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
