import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { TrendingUp, Sparkles } from 'lucide-react';
import { format, subDays, startOfDay, eachDayOfInterval, eachWeekOfInterval, startOfWeek } from 'date-fns';

type DateRangeOption = 'last7days' | 'last30days' | 'thisMonth' | 'last3months' | 'allTime';

interface NonBookingTrendChartProps {
  dateRange: DateRangeOption;
}

export function NonBookingTrendChart({ dateRange }: NonBookingTrendChartProps) {
  const { data: trendData, isLoading } = useQuery({
    queryKey: ['non-booking-trends', dateRange],
    queryFn: async () => {
      const days = dateRange === 'last7days' ? 7 : 
                   dateRange === 'last30days' ? 30 :
                   dateRange === 'thisMonth' ? 30 :
                   dateRange === 'last3months' ? 90 : 180;
      
      const startDate = startOfDay(subDays(new Date(), days));
      const useWeekly = days > 30;
      
      // Use server-side aggregation to avoid 1000 row limit
      const { data, error } = await supabase.rpc('get_non_booking_trends', {
        start_date: startDate.toISOString().split('T')[0],
        group_by_week: useWeekly
      });

      if (error) throw error;

      // Fill in missing dates/weeks with zeros for complete chart
      const trendMap = new Map<string, { nonBookings: number; transcribed: number; highReadiness: number }>();
      
      (data || []).forEach((row: { period_date: string; non_bookings: number; transcribed: number; high_readiness: number }) => {
        const key = row.period_date;
        trendMap.set(key, {
          nonBookings: Number(row.non_bookings) || 0,
          transcribed: Number(row.transcribed) || 0,
          highReadiness: Number(row.high_readiness) || 0,
        });
      });

      if (useWeekly) {
        const weeks = eachWeekOfInterval(
          { start: startDate, end: new Date() },
          { weekStartsOn: 1 }
        );

        return weeks.map(weekStart => {
          const key = format(weekStart, 'yyyy-MM-dd');
          const existing = trendMap.get(key);
          return {
            date: format(weekStart, 'MMM d'),
            nonBookings: existing?.nonBookings || 0,
            transcribed: existing?.transcribed || 0,
            highReadiness: existing?.highReadiness || 0,
          };
        });
      } else {
        const allDays = eachDayOfInterval({ start: startDate, end: new Date() });

        return allDays.map(day => {
          const key = format(day, 'yyyy-MM-dd');
          const existing = trendMap.get(key);
          return {
            date: format(day, 'MMM d'),
            nonBookings: existing?.nonBookings || 0,
            transcribed: existing?.transcribed || 0,
            highReadiness: existing?.highReadiness || 0,
          };
        });
      }
    },
  });

  if (isLoading) {
    return <Skeleton className="h-[350px]" />;
  }

  const hasData = trendData && trendData.some(d => d.nonBookings > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-amber-500" />
          Non-Booking Trends
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="nonBookings" 
                  name="Non-Bookings"
                  stroke="hsl(var(--chart-1))" 
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="transcribed" 
                  name="Transcribed"
                  stroke="hsl(var(--chart-2))" 
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="highReadiness" 
                  name="High Readiness"
                  stroke="hsl(var(--destructive))" 
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[280px] flex flex-col items-center justify-center text-center">
            <div className="p-4 rounded-full bg-amber-500/10 mb-4">
              <Sparkles className="h-8 w-8 text-amber-500" />
            </div>
            <h4 className="font-medium mb-2">No Trend Data Yet</h4>
            <p className="text-sm text-muted-foreground max-w-[320px]">
              Non-booking trends will appear here as calls are logged over time
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
