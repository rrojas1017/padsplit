import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ReasonCodeChartProps {
  data: Array<{
    code: string;
    count: number;
    pct: number;
    avg_preventability: number;
  }>;
}

export function ReasonCodeChart({ data }: ReasonCodeChartProps) {
  if (!data?.length) return null;

  const sorted = [...data].sort((a, b) => b.count - a.count);

  const getBarColor = (preventability: number) => {
    if (preventability >= 7) return 'hsl(var(--destructive))';
    if (preventability >= 4) return 'hsl(45, 93%, 47%)';
    return 'hsl(var(--muted-foreground))';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Reason Code Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(300, sorted.length * 36)}>
          <BarChart data={sorted} layout="vertical" margin={{ left: 200, right: 30, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis type="number" className="text-xs fill-muted-foreground" />
            <YAxis 
              type="category" 
              dataKey="code" 
              width={190} 
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
            />
            <Tooltip 
              formatter={(value: number, name: string, props: any) => {
                if (name === 'count') return [`${value} cases (${props.payload.pct?.toFixed(1)}%)`, 'Count'];
                return [value, name];
              }}
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {sorted.map((entry, index) => (
                <Cell key={index} fill={getBarColor(entry.avg_preventability)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground justify-center">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-destructive inline-block" /> High preventability (7+)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'hsl(45, 93%, 47%)' }} /> Medium (4-6)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-muted-foreground inline-block" /> Low (1-3)</span>
        </div>
      </CardContent>
    </Card>
  );
}
