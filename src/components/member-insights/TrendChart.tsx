import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { useSentimentTrends, TimeRangeOption } from '@/hooks/useSentimentTrends';

const TrendChart = () => {
  const [timeRange, setTimeRange] = useState<TimeRangeOption>('6m');
  const { chartData, isLoading, error } = useSentimentTrends(timeRange);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border rounded-lg p-3 shadow-lg">
          <p className="font-medium mb-1">{data.fullDate}</p>
          {data.dateRange && (
            <p className="text-xs text-muted-foreground mb-2">Period: {data.dateRange}</p>
          )}
          <p className="text-sm text-muted-foreground">Calls Analyzed: {data.calls}</p>
          <div className="mt-2 space-y-1">
            <p className="text-sm">
              <span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-2" />
              Positive: {data.positive}%
            </p>
            <p className="text-sm">
              <span className="inline-block w-3 h-3 rounded-full bg-amber-500 mr-2" />
              Neutral: {data.neutral}%
            </p>
            <p className="text-sm">
              <span className="inline-block w-3 h-3 rounded-full bg-destructive mr-2" />
              Negative: {data.negative}%
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const getTimeRangeLabel = (range: TimeRangeOption): string => {
    switch (range) {
      case '3m': return 'Last 3 months';
      case '6m': return 'Last 6 months';
      case '12m': return 'Last 12 months';
      case 'all': return 'All time';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Sentiment Trends Over Time
          </CardTitle>
          <Skeleton className="h-9 w-[140px]" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Sentiment Trends Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <TrendingUp className="h-10 w-10 mb-2 opacity-50" />
            <p>Failed to load trends</p>
            <p className="text-xs mt-1">Please try again later</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length < 2) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Sentiment Trends Over Time
          </CardTitle>
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRangeOption)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue>{getTimeRangeLabel(timeRange)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3m">Last 3 months</SelectItem>
              <SelectItem value="6m">Last 6 months</SelectItem>
              <SelectItem value="12m">Last 12 months</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <TrendingUp className="h-10 w-10 mb-2 opacity-50" />
            <p>Run more analyses to see trends</p>
            <p className="text-xs mt-1">At least 2 analyses needed</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Sentiment Trends Over Time
        </CardTitle>
        <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRangeOption)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue>{getTimeRangeLabel(timeRange)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3m">Last 3 months</SelectItem>
            <SelectItem value="6m">Last 6 months</SelectItem>
            <SelectItem value="12m">Last 12 months</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                domain={[0, 100]} 
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 12 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="positive" 
                stroke="#22c55e" 
                strokeWidth={2}
                dot={{ fill: '#22c55e', strokeWidth: 2 }}
                name="Positive"
              />
              <Line 
                type="monotone" 
                dataKey="neutral" 
                stroke="#f59e0b" 
                strokeWidth={2}
                dot={{ fill: '#f59e0b', strokeWidth: 2 }}
                name="Neutral"
              />
              <Line 
                type="monotone" 
                dataKey="negative" 
                stroke="#ef4444" 
                strokeWidth={2}
                dot={{ fill: '#ef4444', strokeWidth: 2 }}
                name="Negative"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default TrendChart;
