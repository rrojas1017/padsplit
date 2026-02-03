import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Sparkles, 
  CheckCircle2, 
  ChevronDown,
  HelpCircle,
  LineChart as LineChartIcon
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { usePainPointEvolution, PainPointStatus, TimeRangeOption } from '@/hooks/usePainPointEvolution';
import { useState } from 'react';
import { cn } from '@/lib/utils';

// Color palette for chart lines
const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const TIME_RANGE_LABELS: Record<TimeRangeOption, string> = {
  '3m': 'Last 3 months',
  '6m': 'Last 6 months',
  '12m': 'Last 12 months',
  'all': 'All time'
};

function getTrendIcon(trend: PainPointStatus['trend']) {
  switch (trend) {
    case 'rising':
      return <TrendingUp className="h-4 w-4 text-red-500" />;
    case 'falling':
      return <TrendingDown className="h-4 w-4 text-green-500" />;
    case 'stable':
      return <Minus className="h-4 w-4 text-muted-foreground" />;
    case 'emerging':
      return <Sparkles className="h-4 w-4 text-purple-500" />;
    case 'resolved':
      return <CheckCircle2 className="h-4 w-4 text-blue-500" />;
  }
}

function getTrendBadge(trend: PainPointStatus['trend']) {
  const config = {
    rising: { label: 'Worsening', className: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20' },
    falling: { label: 'Improving', className: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20' },
    stable: { label: 'Stable', className: 'bg-muted text-muted-foreground' },
    emerging: { label: 'Emerging', className: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20' },
    resolved: { label: 'Resolved', className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20' },
  };
  
  const { label, className } = config[trend];
  return (
    <Badge variant="outline" className={className}>
      {getTrendIcon(trend)}
      <span className="ml-1">{label}</span>
    </Badge>
  );
}

function formatTrendDelta(delta: number, trend: PainPointStatus['trend']): string {
  if (trend === 'emerging') return 'NEW';
  if (trend === 'resolved') return '—';
  if (delta === 0) return '—';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(0)}%`;
}

export function PainPointEvolutionPanel() {
  const [timeRange, setTimeRange] = useState<TimeRangeOption>('6m');
  const { chartData, categories, statuses, statusSummary, isLoading, error } = usePainPointEvolution(timeRange);
  const [isTableExpanded, setIsTableExpanded] = useState(false);
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (category: string) => {
    setHiddenCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LineChartIcon className="h-5 w-5" />
            Pain Point Evolution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LineChartIcon className="h-5 w-5" />
            Pain Point Evolution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Failed to load evolution data</p>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length < 2) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <LineChartIcon className="h-5 w-5" />
              Pain Point Evolution
            </CardTitle>
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRangeOption)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3m">Last 3 months</SelectItem>
                <SelectItem value="6m">Last 6 months</SelectItem>
                <SelectItem value="12m">Last 12 months</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <LineChartIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">
              Run more analyses to see how pain points evolve over time
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              At least 2 completed analyses are needed within {TIME_RANGE_LABELS[timeRange].toLowerCase()}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Get normalized category names for chart
  const normalizedCategories = categories.map(cat => 
    cat.toLowerCase().trim().replace(/\s+/g, ' ')
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <LineChartIcon className="h-5 w-5" />
              Pain Point Evolution
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Monthly trends across {chartData.length} months
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRangeOption)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3m">Last 3 months</SelectItem>
                <SelectItem value="6m">Last 6 months</SelectItem>
                <SelectItem value="12m">Last 12 months</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs">
                  <p className="text-sm">
                    Track how member concerns change over time across multiple analyses. 
                    See which issues are growing, shrinking, or newly emerging.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Line Chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }} 
                className="text-muted-foreground"
              />
              <YAxis 
                tick={{ fontSize: 12 }} 
                className="text-muted-foreground"
                tickFormatter={(value) => `${value}%`}
              />
              <RechartsTooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                formatter={(value: number) => [`${value}%`, '']}
              />
              {normalizedCategories.map((cat, index) => {
                if (hiddenCategories.has(cat)) return null;
                return (
                  <Line
                    key={cat}
                    type="monotone"
                    dataKey={cat}
                    name={categories[index]}
                    stroke={CHART_COLORS[index % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    connectNulls
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Interactive Legend */}
        <div className="flex flex-wrap justify-center gap-2 mt-2">
          {categories.map((cat, index) => {
            const normalizedCat = normalizedCategories[index];
            const isHidden = hiddenCategories.has(normalizedCat);
            return (
              <button
                key={cat}
                onClick={() => toggleCategory(normalizedCat)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all text-sm",
                  isHidden 
                    ? "opacity-40 line-through border-dashed border-muted-foreground/30" 
                    : "opacity-100 hover:bg-muted border-border"
                )}
              >
                <span 
                  className="w-3 h-3 rounded-full shrink-0" 
                  style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                />
                <span>{cat}</span>
              </button>
            );
          })}
        </div>

        {/* Status Summary Badges */}
        <div className="flex flex-wrap gap-3">
          {statusSummary.rising > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <TrendingUp className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium text-red-700 dark:text-red-400">
                {statusSummary.rising} Rising
              </span>
            </div>
          )}
          {statusSummary.falling > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
              <TrendingDown className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-green-700 dark:text-green-400">
                {statusSummary.falling} Improving
              </span>
            </div>
          )}
          {statusSummary.emerging > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium text-purple-700 dark:text-purple-400">
                {statusSummary.emerging} Emerging
              </span>
            </div>
          )}
          {statusSummary.resolved > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <CheckCircle2 className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                {statusSummary.resolved} Resolved
              </span>
            </div>
          )}
        </div>

        {/* Collapsible Detail Table */}
        <Collapsible open={isTableExpanded} onOpenChange={setIsTableExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between">
              <span>View Top Pain Points ({statuses.length})</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${isTableExpanded ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4">
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pain Point</TableHead>
                    <TableHead className="text-right">Current</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statuses.map((status) => (
                    <TableRow key={status.category}>
                      <TableCell className="font-medium">{status.category}</TableCell>
                      <TableCell className="text-right">
                        {status.currentFrequency !== null 
                          ? `${status.currentFrequency.toFixed(0)}%` 
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={
                          status.trendDelta > 0 
                            ? 'text-red-600 dark:text-red-400' 
                            : status.trendDelta < 0 
                              ? 'text-green-600 dark:text-green-400' 
                              : 'text-muted-foreground'
                        }>
                          {formatTrendDelta(status.trendDelta, status.trend)}
                        </span>
                      </TableCell>
                      <TableCell>{getTrendBadge(status.trend)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
