import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ReasonCodeChartProps {
  data: {
    total_cases?: number;
    preventable_churn?: number;
    unpreventable_churn?: number;
    by_category?: Array<{
      category: string;
      count: number;
      percentage: number;
      description?: string;
    }>;
    // Legacy nested format
    distribution?: Array<{
      reason_group: string;
      count: number;
      percentage: number;
      details?: string;
    }>;
    methodology?: string;
  } | Array<{
    code: string;
    count: number;
    pct: number;
  }>;
}

export function ReasonCodeChart({ data }: ReasonCodeChartProps) {
  if (!data) return null;

  let chartData: Array<{ name: string; count: number; pct: number; details?: string }> = [];
  let totalCases: number | undefined;
  let preventable: number | undefined;
  let unpreventable: number | undefined;
  let methodology: string | undefined;

  if (Array.isArray(data)) {
    chartData = data.map(d => ({ name: d.code, count: d.count, pct: d.pct }));
  } else {
    totalCases = data.total_cases;
    preventable = data.preventable_churn;
    unpreventable = data.unpreventable_churn;
    methodology = data.methodology;

    if (data.by_category?.length) {
      chartData = data.by_category.map(d => ({
        name: d.category,
        count: d.count,
        pct: d.percentage,
        details: d.description,
      }));
    } else if (data.distribution?.length) {
      chartData = data.distribution.map(d => ({
        name: d.reason_group,
        count: d.count,
        pct: d.percentage,
        details: d.details,
      }));
    }
  }

  if (!chartData.length) return null;

  const sorted = [...chartData].sort((a, b) => b.count - a.count);

  const COLORS = [
    'hsl(var(--destructive))',
    'hsl(142, 71%, 45%)',
    'hsl(45, 93%, 47%)',
    'hsl(var(--primary))',
    'hsl(var(--muted-foreground))',
    'hsl(262, 83%, 58%)',
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Reason Code Distribution</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary stat cards */}
        {totalCases != null && (
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-lg font-bold text-foreground">{totalCases}</p>
              <p className="text-xs text-muted-foreground">Total Cases</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-destructive/10">
              <p className="text-lg font-bold text-destructive">{preventable}</p>
              <p className="text-xs text-muted-foreground">Preventable</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-lg font-bold text-foreground">{unpreventable}</p>
              <p className="text-xs text-muted-foreground">Unpreventable</p>
            </div>
          </div>
        )}

        <ResponsiveContainer width="100%" height={Math.max(250, sorted.length * 50)}>
          <BarChart data={sorted} layout="vertical" margin={{ left: 180, right: 30, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis type="number" className="text-xs fill-muted-foreground" />
            <YAxis
              type="category"
              dataKey="name"
              width={170}
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
            />
            <Tooltip
              formatter={(value: number, _name: string, props: any) => {
                return [`${value} cases (${props.payload.pct?.toFixed(1)}%)`, 'Count'];
              }}
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {sorted.map((_entry, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Detail cards */}
        <div className="space-y-2">
          {sorted.map((item, i) => (
            <div key={i} className="flex items-start gap-3 text-sm border border-border rounded-lg p-3">
              <div className="w-3 h-3 rounded-sm flex-shrink-0 mt-1" style={{ background: COLORS[i % COLORS.length] }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-foreground">{item.name}</p>
                  <Badge variant="secondary" className="flex-shrink-0">{item.count} ({item.pct?.toFixed(1)}%)</Badge>
                </div>
                {item.details && (
                  <p className="text-xs text-muted-foreground mt-1">{item.details}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {methodology && (
          <p className="text-xs text-muted-foreground italic border-t border-border pt-3">{methodology}</p>
        )}
      </CardContent>
    </Card>
  );
}
