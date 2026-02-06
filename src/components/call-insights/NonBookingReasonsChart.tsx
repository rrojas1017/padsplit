import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { AlertCircle, Sparkles } from 'lucide-react';
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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

// Helper to truncate text
const truncateText = (text: string, maxLength: number = 55): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
};

export function NonBookingReasonsChart({ 
  reasons = [], 
  onRunAnalysis,
  isAnalyzing = false 
}: NonBookingReasonsChartProps) {
  const hasData = reasons.length > 0;

  // Transform data for chart - limit to top 5, use numeric indices
  const chartData = reasons.slice(0, 5).map((r, index) => ({
    index: index + 1,
    name: `${index + 1}`,
    fullReason: r.reason,
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
          <div className="space-y-4">
            {/* Chart area with numeric Y-axis */}
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={chartData} 
                  layout="vertical"
                  margin={{ top: 5, right: 40, left: 5, bottom: 5 }}
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
                    width={24}
                    tick={{ fontSize: 12, fontWeight: 600, fill: 'hsl(var(--foreground))' }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip 
                    formatter={(value: number, name: string, props: any) => [
                      `${value}% (${props.payload.count} calls)`,
                      'Frequency'
                    ]}
                    labelFormatter={(label: string, payload: any) => {
                      if (payload && payload[0]) {
                        return payload[0].payload.fullReason;
                      }
                      return label;
                    }}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      maxWidth: '300px',
                    }}
                    wrapperStyle={{ zIndex: 50 }}
                  />
                  <Bar 
                    dataKey="value" 
                    radius={[0, 4, 4, 0]}
                    maxBarSize={28}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                    <LabelList 
                      dataKey="value" 
                      position="right" 
                      formatter={(v: number) => `${v}%`}
                      style={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Legend area */}
            <div className="border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Legend</p>
              <TooltipProvider delayDuration={200}>
                <div className="space-y-1.5">
                  {chartData.map((item) => (
                    <UITooltip key={item.index}>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2 cursor-default group">
                          <span className="shrink-0 w-4 text-xs font-mono font-semibold text-muted-foreground">
                            {item.index}.
                          </span>
                          <div 
                            className="h-2.5 w-2.5 rounded-sm shrink-0" 
                            style={{ backgroundColor: item.fill }}
                          />
                          <span className="text-sm truncate flex-1 group-hover:text-primary transition-colors">
                            {truncateText(item.fullReason)}
                          </span>
                          <Badge variant="secondary" className="shrink-0 text-xs px-1.5 py-0">
                            {item.count}
                          </Badge>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent 
                        side="top" 
                        align="start"
                        className="max-w-xs text-sm"
                      >
                        {item.fullReason}
                      </TooltipContent>
                    </UITooltip>
                  ))}
                </div>
              </TooltipProvider>
            </div>
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
