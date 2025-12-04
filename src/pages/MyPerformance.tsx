import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { KPICard } from '@/components/dashboard/KPICard';
import { DateRangeFilter, DateFilterValue } from '@/components/dashboard/DateRangeFilter';
import { useAuth } from '@/contexts/AuthContext';
import { useBookings } from '@/contexts/BookingsContext';
import { useAgents } from '@/contexts/AgentsContext';
import { CalendarDays, TrendingUp, Clock, CheckCircle2, Trophy } from 'lucide-react';
import { format, subDays, startOfMonth, startOfDay, endOfDay } from 'date-fns';
import { Area, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

// Helper to get date range from filter
function getDateRangeFromFilter(filter: DateFilterValue): { start: Date; end: Date } {
  const today = new Date();
  const end = endOfDay(today);
  
  switch (filter) {
    case 'today':
      return { start: startOfDay(today), end };
    case 'yesterday':
      const yesterday = subDays(today, 1);
      return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
    case '7d':
      return { start: startOfDay(subDays(today, 6)), end };
    case '30d':
      return { start: startOfDay(subDays(today, 29)), end };
    case 'month':
      return { start: startOfMonth(today), end };
    case 'all':
      return { start: new Date(0), end };
    default:
      return { start: startOfDay(today), end };
  }
}

// Helper to get previous period for comparison
function getPreviousPeriod(filter: DateFilterValue): { start: Date; end: Date } {
  const today = new Date();
  
  switch (filter) {
    case 'today':
      const yesterday = subDays(today, 1);
      return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
    case 'yesterday':
      const dayBefore = subDays(today, 2);
      return { start: startOfDay(dayBefore), end: endOfDay(dayBefore) };
    case '7d':
      return { start: startOfDay(subDays(today, 13)), end: endOfDay(subDays(today, 7)) };
    case '30d':
      return { start: startOfDay(subDays(today, 59)), end: endOfDay(subDays(today, 30)) };
    case 'month':
      const prevMonthEnd = subDays(startOfMonth(today), 1);
      const prevMonthStart = startOfMonth(prevMonthEnd);
      return { start: prevMonthStart, end: endOfDay(prevMonthEnd) };
    case 'all':
      return { start: new Date(0), end: new Date(0) }; // No comparison for all time
    default:
      return { start: startOfDay(subDays(today, 1)), end: endOfDay(subDays(today, 1)) };
  }
}

// Helper to get filter label
function getFilterLabel(filter: DateFilterValue): string {
  switch (filter) {
    case 'today': return 'Today';
    case 'yesterday': return 'Yesterday';
    case '7d': return 'This Week';
    case '30d': return 'Last 30 Days';
    case 'month': return 'This Month';
    case 'all': return 'All Time';
    default: return 'Today';
  }
}

export default function MyPerformance() {
  const { user } = useAuth();
  const { bookings, isLoading: bookingsLoading } = useBookings();
  const { agents, isLoading: agentsLoading } = useAgents();
  const [dateFilter, setDateFilter] = useState<DateFilterValue>('7d');
  
  const isLoading = bookingsLoading || agentsLoading;
  
  // Find the agent linked to the current user
  const myAgent = agents.find(a => a.userId === user?.id);
  
  const today = new Date();
  const { start: periodStart, end: periodEnd } = getDateRangeFromFilter(dateFilter);
  const { start: prevStart, end: prevEnd } = getPreviousPeriod(dateFilter);
  
  // Get agent's bookings
  const myBookings = myAgent ? bookings.filter(b => b.agentId === myAgent.id) : [];
  
  // Filter bookings for selected period
  const periodBookings = myBookings.filter(b => 
    b.bookingDate >= periodStart && b.bookingDate <= periodEnd
  );
  
  // Filter bookings for previous period (for comparison)
  const prevPeriodBookings = dateFilter !== 'all' 
    ? myBookings.filter(b => b.bookingDate >= prevStart && b.bookingDate <= prevEnd)
    : [];
  
  // Calculate rank among all active agents for the selected period
  const activeAgents = agents.filter(a => a.active);
  const allAgentBookings = activeAgents.map(a => ({
    agent: a,
    bookings: bookings.filter(b => 
      b.agentId === a.id && b.bookingDate >= periodStart && b.bookingDate <= periodEnd
    ).length
  })).sort((a, b) => {
    if (b.bookings !== a.bookings) {
      return b.bookings - a.bookings;
    }
    return a.agent.name.localeCompare(b.agent.name);
  });
  
  // Calculate accurate rank with tie handling
  const myBookingsCount = myAgent 
    ? allAgentBookings.find(a => a.agent.id === myAgent.id)?.bookings || 0 
    : 0;
  
  const agentsWithMoreBookings = allAgentBookings.filter(a => a.bookings > myBookingsCount).length;
  const trueRank = myAgent ? agentsWithMoreBookings + 1 : 0;
  
  const agentsWithSameBookings = allAgentBookings.filter(a => a.bookings === myBookingsCount).length;
  const isTied = myAgent && agentsWithSameBookings > 1;
  const hasNoBookings = myBookingsCount === 0;
  
  // Prepare chart data based on filter
  const chartData = [];
  const chartDays = dateFilter === 'today' ? 1 : dateFilter === 'yesterday' ? 1 : dateFilter === '7d' ? 7 : dateFilter === '30d' ? 30 : dateFilter === 'month' ? Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) : 14;
  
  for (let i = chartDays - 1; i >= 0; i--) {
    const date = subDays(today, i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayBookings = myBookings.filter(b => format(b.bookingDate, 'yyyy-MM-dd') === dateStr);
    chartData.push({
      date: chartDays <= 7 ? format(date, 'EEE') : format(date, 'M/d'),
      bookings: dayBookings.length,
    });
  }

  // Calculate change percentage
  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round((current - previous) / previous * 100);
  };

  const kpiData: { label: string; value: number; previousValue: number; change: number; changeType: 'increase' | 'decrease' | 'neutral' }[] = [
    {
      label: `${getFilterLabel(dateFilter)} Bookings`,
      value: periodBookings.length,
      previousValue: prevPeriodBookings.length,
      change: dateFilter === 'all' ? 0 : calculateChange(periodBookings.length, prevPeriodBookings.length),
      changeType: dateFilter === 'all' ? 'neutral' : (periodBookings.length >= prevPeriodBookings.length ? 'increase' : 'decrease'),
    },
    {
      label: 'Pending Move-Ins',
      value: periodBookings.filter(b => b.status === 'Pending Move-In').length,
      previousValue: prevPeriodBookings.filter(b => b.status === 'Pending Move-In').length,
      change: 0,
      changeType: 'neutral',
    },
    {
      label: 'Confirmed Move-Ins',
      value: periodBookings.filter(b => b.status === 'Moved In').length,
      previousValue: prevPeriodBookings.filter(b => b.status === 'Moved In').length,
      change: dateFilter === 'all' ? 0 : calculateChange(
        periodBookings.filter(b => b.status === 'Moved In').length,
        prevPeriodBookings.filter(b => b.status === 'Moved In').length
      ),
      changeType: dateFilter === 'all' ? 'neutral' : (periodBookings.filter(b => b.status === 'Moved In').length >= prevPeriodBookings.filter(b => b.status === 'Moved In').length ? 'increase' : 'decrease'),
    },
    {
      label: 'Rank',
      value: hasNoBookings ? 0 : trueRank,
      previousValue: activeAgents.length,
      change: 0,
      changeType: 'neutral',
    },
  ];

  const icons = [
    <CalendarDays className="w-5 h-5" />,
    <Clock className="w-5 h-5" />,
    <CheckCircle2 className="w-5 h-5" />,
    <Trophy className="w-5 h-5" />,
  ];

  if (isLoading) {
    return (
      <DashboardLayout 
        title="My Performance" 
        subtitle="Loading your performance data..."
      >
        <div className="mb-6">
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="lg:col-span-2 h-[300px] rounded-xl" />
          <Skeleton className="h-[300px] rounded-xl" />
        </div>
      </DashboardLayout>
    );
  }

  const displayName = myAgent?.name || user?.name || 'Agent';
  const periodLabel = getFilterLabel(dateFilter).toLowerCase();

  return (
    <DashboardLayout 
      title="My Performance" 
      subtitle={`Welcome back, ${displayName}`}
      actions={
        <DateRangeFilter 
          defaultValue={dateFilter} 
          onRangeChange={(value) => setDateFilter(value)} 
          includeAllTime={true}
        />
      }
    >
      {/* Rank Banner */}
      <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-accent/20 to-accent/5 border border-accent/30 flex items-center gap-4 animate-slide-up">
        <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
          <Trophy className="w-6 h-6 text-accent" />
        </div>
        <div>
          <p className="text-foreground font-semibold">
            {!myAgent 
              ? 'Account not linked to an agent profile'
              : hasNoBookings
                ? `Complete your first booking to get ranked!`
                : isTied 
                  ? `You're tied for #${trueRank} ${periodLabel} with ${agentsWithSameBookings - 1} other${agentsWithSameBookings > 2 ? 's' : ''}`
                  : `You're ranked #${trueRank} out of ${activeAgents.length} agents ${periodLabel}`
            }
          </p>
          <p className="text-muted-foreground text-sm">
            {!myAgent 
              ? 'Contact an administrator to link your account'
              : hasNoBookings
                ? 'Make your first booking to start climbing the leaderboard!'
                : trueRank <= 3 
                  ? "You're in the top 3!" 
                  : `Keep going! ${trueRank - 3} position${trueRank - 3 > 1 ? 's' : ''} away from top 3`
            }
          </p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpiData.map((kpi, index) => (
          <KPICard 
            key={kpi.label} 
            data={kpi} 
            icon={icons[index]}
            delay={index * 100}
          />
        ))}
      </div>

      {/* Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 bg-card rounded-xl p-6 border border-border shadow-card animate-slide-up" style={{ animationDelay: '200ms' }}>
          <h3 className="text-lg font-semibold text-foreground mb-4">Performance Trend</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorMyBookings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="bookings" 
                  stroke="hsl(var(--accent))" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorMyBookings)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Bookings List */}
        <div className="bg-card rounded-xl p-6 border border-border shadow-card animate-slide-up" style={{ animationDelay: '300ms' }}>
          <h3 className="text-lg font-semibold text-foreground mb-4">
            {dateFilter === 'today' ? "Today's Bookings" : "Recent Bookings"}
          </h3>
          <div className="space-y-3">
            {periodBookings.length === 0 ? (
              <p className="text-muted-foreground text-sm">No bookings {periodLabel}. Keep going!</p>
            ) : (
              periodBookings.slice(0, 5).map((booking) => (
                <div key={booking.id} className="p-3 rounded-lg bg-muted/50 border border-border">
                  <p className="font-medium text-foreground text-sm">{booking.memberName}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-muted-foreground">
                      {booking.marketCity}, {booking.marketState}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      booking.status === 'Moved In' ? 'bg-success/20 text-success' :
                      booking.status === 'Pending Move-In' ? 'bg-warning/20 text-warning' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {booking.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
