import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { usePageTracking } from '@/hooks/usePageTracking';
import { KPICard } from '@/components/dashboard/KPICard';
import { BookingsChart } from '@/components/dashboard/BookingsChart';
import { LeaderboardTable } from '@/components/dashboard/LeaderboardTable';
import { MarketChart } from '@/components/dashboard/MarketChart';
import { DateRangeFilter, DateFilterValue, CustomDateRange } from '@/components/dashboard/DateRangeFilter';
import { SiteFilter } from '@/components/dashboard/SiteFilter';
import { CalendarDays, Users, Clock, CheckCircle2, DollarSign, Timer, FileCheck, TrendingDown, PhoneOff, Repeat } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBookings } from '@/contexts/BookingsContext';
import { useAgents } from '@/contexts/AgentsContext';
import { Navigate, Link } from 'react-router-dom';
import { calculateKPIData, calculateChartData, calculateLeaderboard, calculateMarketData, calculateInsightsData, calculateNonBookingCount, DateRangeFilter as DateRangeFilterType, CustomDateRange as CalcCustomDateRange } from '@/utils/dashboardCalculations';
import { Skeleton } from '@/components/ui/skeleton';
import { useBillingData, DateRangeType } from '@/hooks/useBillingData';
import { formatCurrency } from '@/utils/billingCalculations';

// Convert DateRangeFilter value to useBillingData format
const getBillingDateRange = (range: DateRangeFilterType): DateRangeType => {
  switch (range) {
    case 'today': return 'today';
    case 'yesterday': return 'yesterday';
    case '7d': return 'thisWeek';
    case '30d': return 'last30Days';
    case 'month': return 'thisMonth';
    case 'all': return 'allTime';
    case 'custom': return 'custom';
    default: return 'today';
  }
};

export default function Dashboard() {
  usePageTracking('view_dashboard');
  const { user } = useAuth();
  const { bookings, isLoading: bookingsLoading } = useBookings();
  const { agents, isLoading: agentsLoading } = useAgents();
  const [dateRange, setDateRange] = useState<DateRangeFilterType>('today');
  const [customDates, setCustomDates] = useState<CalcCustomDateRange | undefined>(undefined);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

  // Billing data for cost breakdown (super admin only)
  const { summary: costSummary, costs, isLoading: costsLoading, isSuperAdmin } = useBillingData(
    getBillingDateRange(dateRange),
    customDates?.from,
    customDates?.to
  );

  // Redirect agents to their performance page
  if (user?.role === 'agent') {
    return <Navigate to="/my-performance" replace />;
  }

  const isLoading = bookingsLoading || agentsLoading;

  // Filter by selected site
  const filteredAgents = selectedSiteId 
    ? agents.filter(a => a.siteId === selectedSiteId)
    : agents;

  const filteredBookings = selectedSiteId
    ? bookings.filter(b => filteredAgents.some(a => a.id === b.agentId))
    : bookings;

  const handleRangeChange = (range: DateFilterValue, dates?: CustomDateRange) => {
    setDateRange(range as DateRangeFilterType);
    setCustomDates(range === 'custom' && dates ? dates : undefined);
  };

  // Calculate real data from Supabase with date filter
  const kpiData = calculateKPIData(filteredBookings, filteredAgents, dateRange, customDates);
  const chartData = calculateChartData(filteredBookings, filteredAgents, dateRange, customDates);
  const leaderboard = calculateLeaderboard(filteredBookings, filteredAgents, dateRange, customDates);
  const marketData = calculateMarketData(filteredBookings, dateRange, customDates);
  const insights = calculateInsightsData(filteredBookings, filteredAgents);
  const nonBookingCount = calculateNonBookingCount(filteredBookings, dateRange, customDates);

  const kpiIcons = [
    <CalendarDays className="w-5 h-5" />,
    <Repeat className="w-5 h-5" />,
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
        {isSuperAdmin && <Skeleton className="h-32 rounded-xl mt-6" />}
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
          <DateRangeFilter onRangeChange={handleRangeChange} includeAllTime={true} includeCustom={true} />
          <SiteFilter onSiteChange={setSelectedSiteId} />
        </div>
        <div className="text-sm text-muted-foreground">
          Last updated: <span className="text-foreground font-medium">{new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Today vs Yesterday Same Time */}
          <div className="p-4 rounded-lg bg-success/10 border border-success/20">
            <p className="text-sm text-success font-medium">
              {insights.todayVsYesterday.changeType === 'increase' ? '+' : insights.todayVsYesterday.changeType === 'decrease' ? '-' : ''}
              {insights.todayVsYesterday.change}% vs Yesterday
            </p>
            <p className="text-muted-foreground text-sm mt-1">
              {insights.todayVsYesterday.todayByNow} bookings by {insights.todayVsYesterday.currentTime} vs {insights.todayVsYesterday.yesterdayByNow} at this time yesterday
            </p>
          </div>
          
          {/* Weekly Top Performer */}
          <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
            <p className="text-sm text-accent font-medium">Top Performer This Week</p>
            <p className="text-muted-foreground text-sm mt-1">
              {insights.weeklyTopPerformer 
                ? `${insights.weeklyTopPerformer.name} leads with ${insights.weeklyTopPerformer.bookings} bookings`
                : 'No bookings this week yet'}
            </p>
          </div>
          
          {/* Weekly Market Leader */}
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-sm text-primary font-medium">Market Leader This Week</p>
            <p className="text-muted-foreground text-sm mt-1">
              {insights.weeklyMarketLeader 
                ? `${insights.weeklyMarketLeader.market} has ${insights.weeklyMarketLeader.bookings} bookings`
                : 'No market data this week'}
            </p>
          </div>
          
          {/* Active Agents Today */}
          <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <p className="text-sm text-purple-500 font-medium">Active Agents Today</p>
            <p className="text-muted-foreground text-sm mt-1">
              {insights.activeAgentsToday} {insights.activeAgentsToday === 1 ? 'agent has' : 'agents have'} logged bookings today
            </p>
          </div>
          
          {/* Pending Move-ins This Week */}
          <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <p className="text-sm text-orange-500 font-medium">Pending Move-ins</p>
            <p className="text-muted-foreground text-sm mt-1">
              {insights.pendingMoveInsThisWeek} move-ins scheduled in the next 7 days
            </p>
          </div>
          
          {/* Non-Booking Calls */}
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center gap-2">
              <PhoneOff className="w-4 h-4 text-amber-500" />
              <p className="text-sm text-amber-500 font-medium">Non-Booking Calls</p>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              {nonBookingCount} call{nonBookingCount !== 1 ? 's' : ''} in selected period
            </p>
          </div>
        </div>
      </div>

      {/* Cost Breakdown - Super Admin Only */}
      {isSuperAdmin && (
        <div className="mt-6 p-6 rounded-xl bg-card border border-border animate-slide-up" style={{ animationDelay: '600ms' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-accent" />
              Cost Breakdown
            </h3>
            <Link to="/billing" className="text-sm text-primary hover:underline">
              View Full Billing →
            </Link>
          </div>
          
          {costsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Total Cost */}
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-primary" />
                  <p className="text-xs text-muted-foreground font-medium uppercase">Total Cost</p>
                </div>
                <p className="text-xl font-bold text-primary">{formatCurrency(costSummary.totalCost)}</p>
                <p className="text-xs text-muted-foreground">{costs.length} API calls</p>
              </div>
              
              {/* Bookings Processed */}
              <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
                <div className="flex items-center gap-2 mb-1">
                  <FileCheck className="w-4 h-4 text-accent" />
                  <p className="text-xs text-muted-foreground font-medium uppercase">Processed</p>
                </div>
                <p className="text-xl font-bold text-accent">{costSummary.uniqueBookingsProcessed}</p>
                <p className="text-xs text-muted-foreground">bookings analyzed</p>
              </div>
              
              {/* Talk Time */}
              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <Timer className="w-4 h-4 text-amber-500" />
                  <p className="text-xs text-muted-foreground font-medium uppercase">Talk Time</p>
                </div>
                <p className="text-xl font-bold text-amber-500">
                  {Math.round(costSummary.totalTalkTimeSeconds / 60)}m
                </p>
                <p className="text-xs text-muted-foreground">audio transcribed</p>
              </div>
              
              {/* Cost per Booking */}
              <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="w-4 h-4 text-purple-500" />
                  <p className="text-xs text-muted-foreground font-medium uppercase">Per Booking</p>
                </div>
                <p className="text-xl font-bold text-purple-500">
                  {costSummary.uniqueBookingsProcessed > 0 
                    ? formatCurrency(costSummary.costPerBooking) 
                    : '—'}
                </p>
                <p className="text-xs text-muted-foreground">avg processing cost</p>
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
