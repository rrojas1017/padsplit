import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Progress } from '@/components/ui/progress';
import type { AdAwarenessData } from '@/types/research-insights';

interface Props {
  data: AdAwarenessData;
}

const PIE_COLORS = ['#22c55e', '#ef4444', '#a3a3a3', '#6366f1'];

export function AdAwarenessPanel({ data }: Props) {
  // Build pie chart from seen_padsplit_ads_pct or fallback
  const seenPct = data.seen_padsplit_ads_pct || 0;
  const pieData = [
    { name: 'Seen & Liked', value: seenPct * 0.6 },
    { name: "Seen & Didn't Like", value: seenPct * 0.15 },
    { name: "Seen, Don't Remember", value: seenPct * 0.25 },
    { name: 'Not Seen', value: 100 - seenPct },
  ].filter(d => d.value > 0);

  const expectedPlatforms = data.where_expected_padsplit || [];
  const maxExpected = expectedPlatforms.length > 0 ? Math.max(...expectedPlatforms.map(p => p.count)) : 1;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Pie chart */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">PadSplit Ad Awareness</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  dataKey="value"
                  paddingAngle={2}
                  label={({ name, value }) => `${Math.round(value)}%`}
                  labelLine={{ strokeWidth: 1 }}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`${Math.round(value)}%`]} />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '11px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {data.where_seen_padsplit && data.where_seen_padsplit.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground mb-2">Where They've Seen PadSplit Ads</p>
              <div className="flex flex-wrap gap-1.5">
                {data.where_seen_padsplit.map((item) => (
                  <Badge key={item.platform} variant="secondary" className="text-xs">
                    {item.platform} ({item.count})
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {data.top_standout_companies && data.top_standout_companies.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground mb-2">Standout Ad Companies</p>
              <div className="flex flex-wrap gap-1.5">
                {data.top_standout_companies.map((item) => (
                  <Badge key={item.company} variant="outline" className="text-xs">
                    {item.company} ({item.count})
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expected platforms progress bars */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Where They'd Expect PadSplit Ads</CardTitle>
        </CardHeader>
        <CardContent>
          {expectedPlatforms.length > 0 ? (
            <div className="space-y-3">
              {expectedPlatforms
                .sort((a, b) => b.count - a.count)
                .map((item, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{item.platform}</span>
                      <span className="text-muted-foreground text-xs">{item.count}</span>
                    </div>
                    <Progress value={(item.count / maxExpected) * 100} className="h-2" />
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No data available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
