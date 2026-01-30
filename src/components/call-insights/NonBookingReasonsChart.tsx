import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AlertCircle, Sparkles } from 'lucide-react';

interface NonBookingReason {
  reason: string;
  count: number;
  percentage: number;
}

interface NonBookingReasonsChartProps {
  reasons?: NonBookingReason[];
  onRunAnalysis?: () => void;
  isAnalyzing?: boolean;
}

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function NonBookingReasonsChart({ 
  reasons = [], 
  onRunAnalysis,
  isAnalyzing = false 
}: NonBookingReasonsChartProps) {
  const hasData = reasons.length > 0;

  // Transform data for chart
  const chartData = reasons.slice(0, 6).map((r, index) => ({
    name: r.reason,
    value: r.percentage,
    count: r.count,
    fill: CHART_COLORS[index % CHART_COLORS.length],
  }));

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Why They Didn't Book
          </CardTitle>
          {onRunAnalysis && !hasData && (
            <Button 
              size="sm" 
              variant="outline"
              onClick={onRunAnalysis}
              disabled={isAnalyzing}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {isAnalyzing ? 'Analyzing...' : 'Analyze'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={chartData} 
                layout="vertical"
                margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
              >
                <XAxis 
                  type="number" 
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  width={120}
                  tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip 
                  formatter={(value: number, name: string, props: any) => [
                    `${value}% (${props.payload.count} calls)`,
                    'Frequency'
                  ]}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar 
                  dataKey="value" 
                  radius={[0, 4, 4, 0]}
                  maxBarSize={32}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[280px] flex flex-col items-center justify-center text-center">
            <div className="p-4 rounded-full bg-amber-500/10 mb-4">
              <Sparkles className="h-8 w-8 text-amber-500" />
            </div>
            <h4 className="font-medium mb-2">No Analysis Data Yet</h4>
            <p className="text-sm text-muted-foreground max-w-[280px]">
              Process transcribed calls and run analysis to discover why members didn't book
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
