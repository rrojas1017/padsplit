import { RatingDistribution } from '@/utils/coachingCalculations';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface RatingDistributionChartProps {
  distribution: RatingDistribution;
}

const COLORS = {
  excellent: 'hsl(var(--success))',
  good: 'hsl(var(--primary))',
  needs_improvement: 'hsl(var(--warning))',
  poor: 'hsl(var(--destructive))',
};

const LABELS = {
  excellent: 'Excellent',
  good: 'Good',
  needs_improvement: 'Needs Work',
  poor: 'Poor',
};

export function RatingDistributionChart({ distribution }: RatingDistributionChartProps) {
  const data = Object.entries(distribution)
    .filter(([_, value]) => value > 0)
    .map(([key, value]) => ({
      name: LABELS[key as keyof typeof LABELS],
      value,
      color: COLORS[key as keyof typeof COLORS],
    }));

  const total = Object.values(distribution).reduce((a, b) => a + b, 0);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-muted-foreground">
        No rating data available
      </div>
    );
  }

  return (
    <div className="h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={70}
            paddingAngle={4}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
            formatter={(value: number) => [`${value} calls`, '']}
          />
          <Legend 
            verticalAlign="bottom" 
            height={36}
            formatter={(value) => <span className="text-xs text-foreground">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
