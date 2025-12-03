import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { KPICard } from '@/components/dashboard/KPICard';
import { useAuth } from '@/contexts/AuthContext';
import { mockBookings, mockAgents, getChartData } from '@/data/mockData';
import { CalendarDays, TrendingUp, Clock, CheckCircle2, Trophy } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { Area, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function MyPerformance() {
  const { user } = useAuth();
  
  // Find agent data - for demo, use first agent if logged in as agent
  const agent = mockAgents.find(a => a.name === user?.name) || mockAgents[0];
  
  const today = new Date();
  const weekAgo = subDays(today, 7);
  
  // Get agent's bookings
  const myBookings = mockBookings.filter(b => b.agentId === agent.id);
  const thisWeekBookings = myBookings.filter(b => b.bookingDate >= weekAgo);
  const todayBookings = myBookings.filter(b => 
    format(b.bookingDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
  );
  
  // Calculate rank
  const allAgentBookings = mockAgents.map(a => ({
    agent: a,
    bookings: mockBookings.filter(b => b.agentId === a.id && b.bookingDate >= weekAgo).length
  })).sort((a, b) => b.bookings - a.bookings);
  
  const myRank = allAgentBookings.findIndex(a => a.agent.id === agent.id) + 1;
  
  // Prepare chart data
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

  const kpiData: { label: string; value: number; previousValue: number; change: number; changeType: 'increase' | 'decrease' | 'neutral' }[] = [
    {
      label: "Today's Bookings",
      value: todayBookings.length,
      previousValue: 3,
      change: Math.round((todayBookings.length - 3) / 3 * 100) || 0,
      changeType: todayBookings.length >= 3 ? 'increase' : 'decrease',
    },
    {
      label: 'This Week',
      value: thisWeekBookings.length,
      previousValue: 18,
      change: Math.round((thisWeekBookings.length - 18) / 18 * 100) || 0,
      changeType: thisWeekBookings.length >= 18 ? 'increase' : 'decrease',
    },
    {
      label: 'Pending Move-Ins',
      value: thisWeekBookings.filter(b => b.status === 'Pending Move-In').length,
      previousValue: 5,
      change: 0,
      changeType: 'neutral',
    },
    {
      label: 'Confirmed Move-Ins',
      value: thisWeekBookings.filter(b => b.status === 'Moved In').length,
      previousValue: 4,
      change: 20,
      changeType: 'increase',
    },
  ];

  const icons = [
    <CalendarDays className="w-5 h-5" />,
    <TrendingUp className="w-5 h-5" />,
    <Clock className="w-5 h-5" />,
    <CheckCircle2 className="w-5 h-5" />,
  ];

  return (
    <DashboardLayout 
      title="My Performance" 
      subtitle={`Welcome back, ${agent.name}`}
    >
      {/* Rank Banner */}
      <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-accent/20 to-accent/5 border border-accent/30 flex items-center gap-4 animate-slide-up">
        <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
          <Trophy className="w-6 h-6 text-accent" />
        </div>
        <div>
          <p className="text-foreground font-semibold">
            You're ranked #{myRank} out of {mockAgents.length} agents
          </p>
          <p className="text-muted-foreground text-sm">
            Keep up the great work! You're {myRank <= 3 ? 'in the top 3!' : `${myRank - 3} bookings away from top 3`}
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
              todayBookings.slice(0, 5).map((booking, i) => (
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
