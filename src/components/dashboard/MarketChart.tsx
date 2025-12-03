import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface MarketChartProps {
  data: { market: string; bookings: number }[];
}

export function MarketChart({ data }: MarketChartProps) {
  return (
    <div className="bg-card rounded-xl p-6 border border-border shadow-card animate-slide-up" style={{ animationDelay: '400ms' }}>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground">Bookings by Market</h3>
        <p className="text-sm text-muted-foreground">Top performing markets</p>
      </div>
      
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
            <XAxis 
              type="number"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            />
            <YAxis 
              type="category"
              dataKey="market"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
              width={100}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
            />
            <Bar 
              dataKey="bookings" 
              radius={[0, 4, 4, 0]}
              fill="hsl(var(--accent))"
            >
              {data.map((_, index) => (
                <Cell 
                  key={`cell-${index}`}
                  fill={index === 0 ? 'hsl(var(--accent))' : `hsl(var(--accent) / ${1 - index * 0.1})`}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
