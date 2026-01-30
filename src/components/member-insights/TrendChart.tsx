import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

interface MemberInsight {
  id: string;
  created_at: string;
  date_range_start?: string;
  date_range_end?: string;
  total_calls_analyzed: number;
  sentiment_distribution: { positive: number; neutral: number; negative: number };
  pain_points: any[];
}

interface TrendChartProps {
  insights: MemberInsight[];
}

const TrendChart = ({ insights }: TrendChartProps) => {
  // Reverse to show oldest first for trend line
  const reversedInsights = [...insights].reverse().slice(-10);
  
  // Count occurrences of each date to detect duplicates
  const dateCounts: Record<string, number> = {};
  reversedInsights.forEach((insight) => {
    const dateKey = format(new Date(insight.created_at), 'MMM d');
    dateCounts[dateKey] = (dateCounts[dateKey] || 0) + 1;
  });
  
  const chartData = reversedInsights.map((insight) => {
    const dateKey = format(new Date(insight.created_at), 'MMM d');
    const needsTime = dateCounts[dateKey] > 1;
    
    // Format date range for tooltip
    let dateRangeText = '';
    if (insight.date_range_start && insight.date_range_end) {
      const start = format(new Date(insight.date_range_start), 'MMM d');
      const end = format(new Date(insight.date_range_end), 'MMM d');
      dateRangeText = `${start} - ${end}`;
    }
    
    return {
      date: needsTime 
        ? format(new Date(insight.created_at), 'MMM d ha') // e.g., "Jan 30 4pm"
        : dateKey,
      fullDate: format(new Date(insight.created_at), 'MMM d, yyyy h:mm a'),
      dateRange: dateRangeText,
      calls: insight.total_calls_analyzed,
      positive: insight.sentiment_distribution?.positive || 0,
      neutral: insight.sentiment_distribution?.neutral || 0,
      negative: insight.sentiment_distribution?.negative || 0,
      painPointCount: insight.pain_points?.length || 0,
    };
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
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

  if (chartData.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Sentiment Trends Over Time
          </CardTitle>
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
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Sentiment Trends Over Time
        </CardTitle>
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