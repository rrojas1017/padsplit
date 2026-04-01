import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { PlatformItem } from '@/types/research-insights';

const PLATFORM_COLORS: Record<string, string> = {
  TikTok: 'hsl(var(--chart-1))',
  Instagram: 'hsl(var(--chart-2))',
  Facebook: 'hsl(var(--chart-3))',
  YouTube: 'hsl(var(--chart-4))',
  'X/Twitter': 'hsl(var(--chart-5))',
  LinkedIn: 'hsl(var(--chart-1))',
  Snapchat: 'hsl(var(--chart-2))',
  'Facebook Groups': 'hsl(var(--chart-3))',
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
            <BarChart data={sorted} layout="vertical" margin={{ left: 100, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" className="text-xs" />
              <YAxis dataKey="platform" type="category" className="text-xs" width={90} />
              <Tooltip
                formatter={(value: number, name: string, entry: any) => [
                  `${value} (${Math.round(entry.payload.pct || 0)}%)`,
                  'Responses'
                ]}
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {sorted.map((entry) => (
                  <Cell key={entry.platform} fill={PLATFORM_COLORS[entry.platform] || 'hsl(var(--primary))'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
