import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { ContentPreferencesData } from '@/types/research-insights';
import { RankedItemsTable } from './RankedItemsTable';

interface Props {
  data: ContentPreferencesData;
}

const DETAIL_PREF_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#a3a3a3'];

export function AdPreferencesPanel({ data }: Props) {
  // Build detail preference pie from the detail_preferences array or use defaults
  const detailPrefs = data.detail_preferences || [];
  const hasPieData = detailPrefs.length > 0;

  const pieData = hasPieData
    ? detailPrefs.map(d => ({ name: d.detail.replace(/_/g, ' '), value: d.count }))
    : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">What Makes Them Stop Scrolling</CardTitle>
        </CardHeader>
        <CardContent>
          <RankedItemsTable
            items={(data.stop_scrolling_triggers || []).map(i => ({ label: i.trigger, count: i.count }))}
            barColor="bg-violet-500"
          />
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">What Makes Them Click an Ad</CardTitle>
        </CardHeader>
        <CardContent>
          <RankedItemsTable
            items={(data.click_motivations || []).map(i => ({ label: i.motivation, count: i.count }))}
            barColor="bg-emerald-500"
          />
        </CardContent>
      </Card>

      {hasPieData && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ad Detail Preference</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    paddingAngle={2}
                    label={({ name, value }) => `${value}`}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={DETAIL_PREF_COLORS[i % DETAIL_PREF_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Preferred Content Types</CardTitle>
        </CardHeader>
        <CardContent>
          <RankedItemsTable
            items={(data.content_type_preferences || []).map(i => ({
              label: i.type.replace(/_/g, ' '),
              count: i.count,
              pct: i.pct,
            }))}
            barColor="bg-sky-500"
          />
        </CardContent>
      </Card>
    </div>
  );
}
