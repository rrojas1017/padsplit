import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { KPICard } from '@/components/dashboard/KPICard';
import { useAuth } from '@/contexts/AuthContext';
import { useBookings } from '@/contexts/BookingsContext';
import { useAgents } from '@/contexts/AgentsContext';
import { CalendarDays, TrendingUp, Clock, CheckCircle2, Trophy } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { Area, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

export default function MyPerformance() {
  const { user } = useAuth();
  const { bookings, isLoading: bookingsLoading } = useBookings();
  const { agents, isLoading: agentsLoading } = useAgents();
  
  const isLoading = bookingsLoading || agentsLoading;
  
  // Find the agent linked to the current user (no fallback - must be properly linked)
  const myAgent = agents.find(a => a.userId === user?.id);
  
  const today = new Date();
  const weekAgo = subDays(today, 7);
  
  // Get agent's bookings
  const myBookings = myAgent ? bookings.filter(b => b.agentId === myAgent.id) : [];
  const thisWeekBookings = myBookings.filter(b => b.bookingDate >= weekAgo);
  const todayBookings = myBookings.filter(b => 
    format(b.bookingDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
  );
  
  // Calculate rank among all active agents with deterministic sorting
  const activeAgents = agents.filter(a => a.active);
  const allAgentBookings = activeAgents.map(a => ({
    agent: a,
    bookings: bookings.filter(b => b.agentId === a.id && b.bookingDate >= weekAgo).length
  })).sort((a, b) => {
    // Primary sort: by bookings (descending)
    if (b.bookings !== a.bookings) {
      return b.bookings - a.bookings;
    }
    // Secondary sort: alphabetical by name (deterministic tie-breaker)
    return a.agent.name.localeCompare(b.agent.name);
  });
  
  // Calculate accurate rank with tie handling
  const myBookingsCount = myAgent 
    ? allAgentBookings.find(a => a.agent.id === myAgent.id)?.bookings || 0 
    : 0;
  
  // True rank = number of agents with MORE bookings + 1
  const agentsWithMoreBookings = allAgentBookings.filter(a => a.bookings > myBookingsCount).length;
  const trueRank = myAgent ? agentsWithMoreBookings + 1 : 0;
  
  // Check for ties (agents with same booking count)
  const agentsWithSameBookings = allAgentBookings.filter(a => a.bookings === myBookingsCount).length;
  const isTied = myAgent && agentsWithSameBookings > 1;
  
  // Prepare chart data for last 7 days
  const chartData = [];
  for (let i = 6; i >= 0; i--) {
    const date = subDays(today, i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayBookings = myBookings.filter(b => format(b.bookingDate, 'yyyy-MM-dd') === dateStr);
    chartData.push({
      date: format(date, 'EEE'),
      bookings: dayBookings.length,
    });
  }

  // Calculate previous period values for comparison
  const prevWeekStart = subDays(today, 14);
  const prevWeekBookings = myBookings.filter(b => b.bookingDate >= prevWeekStart && b.bookingDate < weekAgo);
  const yesterdayBookings = myBookings.filter(b => 
    format(b.bookingDate, 'yyyy-MM-dd') === format(subDays(today, 1), 'yyyy-MM-dd')
  );

  const kpiData: { label: string; value: number; previousValue: number; change: number; changeType: 'increase' | 'decrease' | 'neutral' }[] = [
    {
      label: "Today's Bookings",
      value: todayBookings.length,
      previousValue: yesterdayBookings.length,
      change: yesterdayBookings.length > 0 ? Math.round((todayBookings.length - yesterdayBookings.length) / yesterdayBookings.length * 100) : 0,
      changeType: todayBookings.length >= yesterdayBookings.length ? 'increase' : 'decrease',
    },
    {
      label: 'This Week',
      value: thisWeekBookings.length,
      previousValue: prevWeekBookings.length,
      change: prevWeekBookings.length > 0 ? Math.round((thisWeekBookings.length - prevWeekBookings.length) / prevWeekBookings.length * 100) : 0,
      changeType: thisWeekBookings.length >= prevWeekBookings.length ? 'increase' : 'decrease',
    },
    {
      label: 'Pending Move-Ins',
      value: thisWeekBookings.filter(b => b.status === 'Pending Move-In').length,
      previousValue: prevWeekBookings.filter(b => b.status === 'Pending Move-In').length,
      change: 0,
      changeType: 'neutral',
    },
    {
      label: 'Confirmed Move-Ins',
      value: thisWeekBookings.filter(b => b.status === 'Moved In').length,
      previousValue: prevWeekBookings.filter(b => b.status === 'Moved In').length,
      change: prevWeekBookings.filter(b => b.status === 'Moved In').length > 0 
        ? Math.round((thisWeekBookings.filter(b => b.status === 'Moved In').length - prevWeekBookings.filter(b => b.status === 'Moved In').length) / prevWeekBookings.filter(b => b.status === 'Moved In').length * 100) 
        : 0,
      changeType: thisWeekBookings.filter(b => b.status === 'Moved In').length >= prevWeekBookings.filter(b => b.status === 'Moved In').length ? 'increase' : 'decrease',
    },
  ];

  const icons = [
    <CalendarDays className="w-5 h-5" />,
    <TrendingUp className="w-5 h-5" />,
    <Clock className="w-5 h-5" />,
    <CheckCircle2 className="w-5 h-5" />,
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

  return (
    <DashboardLayout 
      title="My Performance" 
      subtitle={`Welcome back, ${displayName}`}
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
              : isTied 
                ? `You're tied for #${trueRank} with ${agentsWithSameBookings - 1} other${agentsWithSameBookings > 2 ? 's' : ''}`
                : `You're ranked #${trueRank} out of ${activeAgents.length} agents`
            }
          </p>
          <p className="text-muted-foreground text-sm">
            {!myAgent 
              ? 'Contact an administrator to link your account'
              : trueRank <= 3 && trueRank > 0 
                ? "You're in the top 3!" 
                : trueRank > 3 
                  ? `Keep going! ${trueRank - 3} position${trueRank - 3 > 1 ? 's' : ''} away from top 3`
                  : 'Complete some bookings to get ranked'
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
          <h3 className="text-lg font-semibold text-foreground mb-4">My Weekly Performance</h3>
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

        {/* Today's Bookings List */}
        <div className="bg-card rounded-xl p-6 border border-border shadow-card animate-slide-up" style={{ animationDelay: '300ms' }}>
          <h3 className="text-lg font-semibold text-foreground mb-4">Today's Bookings</h3>
          <div className="space-y-3">
            {todayBookings.length === 0 ? (
              <p className="text-muted-foreground text-sm">No bookings yet today. Keep going!</p>
            ) : (
              todayBookings.slice(0, 5).map((booking) => (
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
