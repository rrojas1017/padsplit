import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

interface MemberInsight {
  id: string;
  created_at: string;
  total_calls_analyzed: number;
  sentiment_distribution: { positive: number; neutral: number; negative: number };
  pain_points: any[];
}

interface TrendChartProps {
  insights: MemberInsight[];
}

const TrendChart = ({ insights }: TrendChartProps) => {
  // Reverse to show oldest first for trend line
  const chartData = [...insights]
    .reverse()
    .slice(-10) // Last 10 analyses
    .map((insight) => ({
      date: format(new Date(insight.created_at), 'MMM d'),
      fullDate: format(new Date(insight.created_at), 'MMM d, yyyy'),
      calls: insight.total_calls_analyzed,
      positive: insight.sentiment_distribution?.positive || 0,
      neutral: insight.sentiment_distribution?.neutral || 0,
      negative: insight.sentiment_distribution?.negative || 0,
      painPointCount: insight.pain_points?.length || 0,
    }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border rounded-lg p-3 shadow-lg">
          <p className="font-medium mb-2">{data.fullDate}</p>
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