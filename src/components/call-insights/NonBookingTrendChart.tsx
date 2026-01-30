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
      
      const { data, error } = await supabase
        .from('bookings')
        .select('booking_date, call_duration_seconds, transcription_status')
        .eq('status', 'Non Booking')
        .gte('booking_date', startDate.toISOString().split('T')[0])
        .order('booking_date', { ascending: true });

      if (error) throw error;

      // Group by day or week based on range
      const useWeekly = days > 30;
      const bookings = data || [];

      if (useWeekly) {
        const weeks = eachWeekOfInterval(
          { start: startDate, end: new Date() },
          { weekStartsOn: 1 }
        );

        return weeks.map(weekStart => {
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);
          
          const weekBookings = bookings.filter(b => {
            const date = new Date(b.booking_date);
            return date >= weekStart && date <= weekEnd;
          });

          return {
            date: format(weekStart, 'MMM d'),
            nonBookings: weekBookings.length,
            transcribed: weekBookings.filter(b => b.transcription_status === 'completed').length,
            highReadiness: weekBookings.filter(b => b.call_duration_seconds && b.call_duration_seconds > 300).length,
          };
        });
      } else {
        const allDays = eachDayOfInterval({ start: startDate, end: new Date() });

        return allDays.map(day => {
          const dayStr = format(day, 'yyyy-MM-dd');
          const dayBookings = bookings.filter(b => b.booking_date === dayStr);

          return {
            date: format(day, 'MMM d'),
            nonBookings: dayBookings.length,
            transcribed: dayBookings.filter(b => b.transcription_status === 'completed').length,
            highReadiness: dayBookings.filter(b => b.call_duration_seconds && b.call_duration_seconds > 300).length,
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
