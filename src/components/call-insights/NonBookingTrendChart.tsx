import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { TrendingUp, Sparkles } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfDay, eachDayOfInterval, eachWeekOfInterval, startOfWeek as startOfWeekUtil } from 'date-fns';

type DateRangeOption = 'thisWeek' | 'lastMonth' | 'thisMonth' | 'last3months' | 'allTime';

interface NonBookingTrendChartProps {
  dateRange: DateRangeOption;
}

export function NonBookingTrendChart({ dateRange }: NonBookingTrendChartProps) {
  const { data: trendData, isLoading } = useQuery({
    queryKey: ['non-booking-trends', dateRange],
    queryFn: async () => {
      const today = new Date();
      let startDate: Date;
      let endDate: Date = today;
      let useWeekly = false;
      
      switch (dateRange) {
        case 'thisWeek':
          startDate = startOfWeek(today, { weekStartsOn: 1 });
          endDate = today;
          useWeekly = false;
          break;
        case 'lastMonth':
          const lastMonthDate = subMonths(today, 1);
          startDate = startOfMonth(lastMonthDate);
          endDate = endOfMonth(lastMonthDate);
          useWeekly = false;
          break;
        case 'thisMonth':
          startDate = startOfMonth(today);
          endDate = today;
          useWeekly = false;
          break;
        case 'last3months':
          startDate = subMonths(today, 3);
          endDate = today;
          useWeekly = true;
          break;
        case 'allTime':
          startDate = new Date('2024-01-01');
          endDate = today;
          useWeekly = true;
          break;
        default:
          startDate = startOfMonth(today);
          endDate = today;
          useWeekly = false;
      }
      
      // Use server-side aggregation to avoid 1000 row limit
      const { data, error } = await supabase.rpc('get_non_booking_trends', {
        start_date: format(startDate, 'yyyy-MM-dd'),
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
          { start: startDate, end: endDate },
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
        const allDays = eachDayOfInterval({ start: startDate, end: endDate });

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
