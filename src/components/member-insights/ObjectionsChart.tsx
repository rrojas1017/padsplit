import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Objection {
  objection: string;
  frequency: number;
  suggested_response?: string;
}

interface ObjectionsChartProps {
  objections: Objection[];
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const ObjectionsChart = ({ objections }: ObjectionsChartProps) => {
  const chartData = objections.slice(0, 8).map((obj, idx) => ({
    name: obj.objection.length > 30 ? obj.objection.substring(0, 30) + '...' : obj.objection,
    fullName: obj.objection,
    frequency: obj.frequency,
    response: obj.suggested_response,
    color: COLORS[idx % COLORS.length]
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border rounded-lg p-3 shadow-lg max-w-xs">
          <p className="font-medium text-sm mb-1">{data.fullName}</p>
          <p className="text-sm text-muted-foreground mb-2">
            Frequency: <span className="font-semibold text-foreground">{data.frequency}%</span>
          </p>
          {data.response && (
            <div className="border-t pt-2 mt-2">
              <p className="text-xs text-muted-foreground">Suggested Response:</p>
              <p className="text-xs mt-1">{data.response}</p>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-amber-500" />
          Common Objections
        </CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" domain={[0, 'auto']} tickFormatter={(v) => `${v}%`} />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    width={150}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="frequency" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Top objection detail */}
            {objections[0]?.suggested_response && (
              <div className="mt-4 p-3 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary">Top Objection Response</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">"{objections[0].objection}"</span>
                </p>
                <p className="text-sm mt-2">
                  <span className="text-primary font-medium">Suggested:</span> {objections[0].suggested_response}
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No objection patterns identified
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ObjectionsChart;