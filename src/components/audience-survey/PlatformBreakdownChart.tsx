import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { PlatformItem } from '@/types/research-insights';

const PLATFORM_COLORS: Record<string, string> = {
  TikTok: '#00f2ea',
  Instagram: '#E1306C',
  Facebook: '#1877F2',
  YouTube: '#FF0000',
  'X/Twitter': '#1DA1F2',
  Twitter: '#1DA1F2',
  LinkedIn: '#0A66C2',
  Snapchat: '#FFFC00',
  'Facebook Groups': '#1877F2',
  Pinterest: '#E60023',
  Reddit: '#FF4500',
};

interface Props {
  data: PlatformItem[];
}

export function PlatformBreakdownChart({ data }: Props) {
  if (!data || data.length === 0) return null;

  const sorted = [...data].sort((a, b) => b.count - a.count);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Social Media Platform Usage</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sorted} layout="vertical" margin={{ left: 110, right: 30, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
              <XAxis type="number" className="text-xs" tickFormatter={(v) => `${v}`} />
              <YAxis dataKey="platform" type="category" className="text-xs" width={100} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: number, _name: string, entry: any) => [
                  `${value} responses (${Math.round(entry.payload.pct || 0)}%)`,
                  'Usage'
                ]}
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={24}>
                {sorted.map((entry) => (
                  <Cell
                    key={entry.platform}
                    fill={PLATFORM_COLORS[entry.platform] || 'hsl(var(--primary))'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
