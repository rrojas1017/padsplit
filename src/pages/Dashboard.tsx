import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { KPICard } from '@/components/dashboard/KPICard';
import { BookingsChart } from '@/components/dashboard/BookingsChart';
import { LeaderboardTable } from '@/components/dashboard/LeaderboardTable';
import { MarketChart } from '@/components/dashboard/MarketChart';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
import { SiteFilter } from '@/components/dashboard/SiteFilter';
import { mockBookings, getKPIData, getChartData, getLeaderboard, getMarketData } from '@/data/mockData';
import { CalendarDays, Users, Clock, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

export default function Dashboard() {
  const { user, hasRole } = useAuth();

  // Redirect agents to their performance page
  if (user?.role === 'agent') {
    return <Navigate to="/my-performance" replace />;
  }

  const kpiData = getKPIData(mockBookings);
  const chartData = getChartData(mockBookings);
  const leaderboard = getLeaderboard(mockBookings);
  const marketData = getMarketData(mockBookings);

  const kpiIcons = [
    <CalendarDays className="w-5 h-5" />,
    <Users className="w-5 h-5" />,
    <Clock className="w-5 h-5" />,
    <CheckCircle2 className="w-5 h-5" />,
  ];

  return (
    <DashboardLayout 
      title="Executive Dashboard" 
      subtitle="Overview of booking performance and agent metrics"
    >
      {/* Filters */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <DateRangeFilter />
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
            <p className="text-sm text-success font-medium">+22% vs Yesterday</p>
            <p className="text-muted-foreground text-sm mt-1">
              Bookings are up, mainly driven by Vixicom (+10) and Atlanta market (+6)
            </p>
          </div>
          <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
            <p className="text-sm text-accent font-medium">Top Performer</p>
            <p className="text-muted-foreground text-sm mt-1">
              {leaderboard[0]?.agentName || 'N/A'} leads with {leaderboard[0]?.bookings || 0} bookings this week
            </p>
          </div>
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-sm text-primary font-medium">Market Opportunity</p>
            <p className="text-muted-foreground text-sm mt-1">
              Houston showing 15% growth potential based on recent trends
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
