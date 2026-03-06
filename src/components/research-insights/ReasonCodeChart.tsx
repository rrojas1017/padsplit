import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ReasonCodeChartProps {
  data: {
    distribution?: Array<{
      reason_group: string;
      count: number;
      percentage: number;
      details?: string;
      reason_codes_included?: string[];
      booking_ids?: string[];
    }>;
    methodology?: string;
  } | Array<{
    code: string;
    count: number;
    pct: number;
    avg_preventability?: number;
  }>;
  onGroupClick?: (groupName: string, bookingIds?: string[], reasonCodes?: string[]) => void;
}

export function ReasonCodeChart({ data, onGroupClick }: ReasonCodeChartProps) {
  if (!data) return null;

  let chartData: Array<{ name: string; count: number; pct: number; details?: string; booking_ids?: string[]; reason_codes_included?: string[] }> = [];
  let methodology: string | undefined;

  if (Array.isArray(data)) {
    chartData = data.map(d => ({ name: d.code, count: d.count, pct: d.pct, details: undefined }));
  } else if (data.distribution?.length) {
    chartData = data.distribution.map(d => ({
      name: d.reason_group,
      count: d.count,
      pct: d.percentage,
      details: d.details,
      booking_ids: d.booking_ids,
      reason_codes_included: d.reason_codes_included,
    }));
    methodology = data.methodology;
  }

  if (!chartData.length) return null;

  const sorted = [...chartData].sort((a, b) => b.count - a.count);

  const COLORS = [
    'hsl(var(--destructive))',
    'hsl(142, 71%, 45%)',
    'hsl(45, 93%, 47%)',
    'hsl(var(--primary))',
    'hsl(var(--muted-foreground))',
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Reason Code Distribution</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ResponsiveContainer width="100%" height={Math.max(250, sorted.length * 50)}>
          <BarChart data={sorted} layout="vertical" margin={{ left: 220, right: 30, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis type="number" className="text-xs fill-muted-foreground" />
            <YAxis
              type="category"
              dataKey="name"
              width={210}
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
            <div
              key={i}
              className={`group flex items-start gap-3 text-sm rounded-lg p-3 transition-all duration-150 ${
                onGroupClick 
                  ? 'cursor-pointer border-2 border-border hover:border-primary/50 hover:bg-accent/50 hover:shadow-sm' 
                  : 'border border-border'
              }`}
              onClick={() => onGroupClick?.(item.name, item.booking_ids, item.reason_codes_included)}
            >
              <div className="w-3 h-3 rounded-sm flex-shrink-0 mt-1" style={{ background: COLORS[i % COLORS.length] }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-foreground">{item.name}</p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="secondary">{item.count} ({item.pct?.toFixed(1)}%)</Badge>
                    {onGroupClick && (
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    )}
                  </div>
                </div>
                {item.details && (
                  <p className="text-xs text-muted-foreground mt-1">{item.details}</p>
                )}
                {onGroupClick && (
                  <p className="text-xs text-primary/70 group-hover:text-primary mt-1 transition-colors">View {item.count} records →</p>
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
