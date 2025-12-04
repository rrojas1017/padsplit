import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { KPICard } from '@/components/dashboard/KPICard';
import { BookingsChart } from '@/components/dashboard/BookingsChart';
import { LeaderboardTable } from '@/components/dashboard/LeaderboardTable';
import { MarketChart } from '@/components/dashboard/MarketChart';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
import { SiteFilter } from '@/components/dashboard/SiteFilter';
import { CalendarDays, Users, Clock, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBookings } from '@/contexts/BookingsContext';
import { useAgents } from '@/contexts/AgentsContext';
import { Navigate } from 'react-router-dom';
import { calculateKPIData, calculateChartData, calculateLeaderboard, calculateMarketData, DateRangeFilter as DateRangeFilterType } from '@/utils/dashboardCalculations';
import { Skeleton } from '@/components/ui/skeleton';

export default function Dashboard() {
  const { user } = useAuth();
  const { bookings, isLoading: bookingsLoading } = useBookings();
  const { agents, isLoading: agentsLoading } = useAgents();
  const [dateRange, setDateRange] = useState<DateRangeFilterType>('today');

  // Redirect agents to their performance page
  if (user?.role === 'agent') {
    return <Navigate to="/my-performance" replace />;
  }

  const isLoading = bookingsLoading || agentsLoading;

  // Calculate real data from Supabase with date filter
  const kpiData = calculateKPIData(bookings, agents, dateRange);
  const chartData = calculateChartData(bookings, agents, dateRange);
  const leaderboard = calculateLeaderboard(bookings, agents, dateRange);
  const marketData = calculateMarketData(bookings, dateRange);

  const kpiIcons = [
    <CalendarDays className="w-5 h-5" />,
    <Users className="w-5 h-5" />,
    <Clock className="w-5 h-5" />,
    <CheckCircle2 className="w-5 h-5" />,
  ];

  if (isLoading) {
    return (
      <DashboardLayout 
        title="Executive Dashboard" 
        subtitle="Overview of booking performance and agent metrics"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Skeleton className="lg:col-span-2 h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      title="Executive Dashboard" 
      subtitle="Overview of booking performance and agent metrics"
    >
      {/* Filters */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <DateRangeFilter onRangeChange={(range) => setDateRange(range as DateRangeFilterType)} />
          <SiteFilter />
        </div>
        <div className="text-sm text-muted-foreground">
          Last updated: <span className="text-foreground font-medium">{new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpiData.map((kpi, index) => (
          <KPICard 
            key={kpi.label} 
            data={kpi} 
            icon={kpiIcons[index]}
            delay={index * 100}
          />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <BookingsChart data={chartData} />
        </div>
        <div>
          <MarketChart data={marketData} />
        </div>
      </div>

      {/* Leaderboard */}
      <LeaderboardTable data={leaderboard} />

      {/* Insights */}
      <div className="mt-6 p-6 rounded-xl bg-card border border-border animate-slide-up" style={{ animationDelay: '500ms' }}>
        <h3 className="text-lg font-semibold text-foreground mb-3">Today's Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-success/10 border border-success/20">
            <p className="text-sm text-success font-medium">
              {kpiData[0].changeType === 'increase' ? '+' : kpiData[0].changeType === 'decrease' ? '-' : ''}
              {kpiData[0].change}% vs Yesterday
            </p>
            <p className="text-muted-foreground text-sm mt-1">
              {kpiData[0].value} total bookings today compared to {kpiData[0].previousValue} yesterday
            </p>
          </div>
          <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
            <p className="text-sm text-accent font-medium">Top Performer</p>
            <p className="text-muted-foreground text-sm mt-1">
              {leaderboard[0]?.agentName || 'N/A'} leads with {leaderboard[0]?.bookings || 0} bookings this week
            </p>
          </div>
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-sm text-primary font-medium">Market Leader</p>
            <p className="text-muted-foreground text-sm mt-1">
              {marketData[0]?.market || 'N/A'} has the most bookings with {marketData[0]?.bookings || 0} total
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
