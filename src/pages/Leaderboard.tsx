import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { usePageTracking } from '@/hooks/usePageTracking';
import { LeaderboardTable } from '@/components/dashboard/LeaderboardTable';
import { DateRangeFilter, DateFilterValue, CustomDateRange } from '@/components/dashboard/DateRangeFilter';
import { SiteFilter } from '@/components/dashboard/SiteFilter';
import { useBookings } from '@/contexts/BookingsContext';
import { useAgents } from '@/contexts/AgentsContext';
import { calculateLeaderboard, DateRangeFilter as DateRangeFilterType, CustomDateRange as CalcCustomDateRange } from '@/utils/dashboardCalculations';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Sparkles, RotateCcw, Users } from 'lucide-react';

export default function Leaderboard() {
  usePageTracking('view_leaderboard');
  const { bookings, isLoading: bookingsLoading } = useBookings();
  const { agents, isLoading: agentsLoading } = useAgents();
  const [dateRange, setDateRange] = useState<DateRangeFilterType>('today');
  const [customDates, setCustomDates] = useState<CalcCustomDateRange | undefined>(undefined);

  const handleRangeChange = (range: DateFilterValue, dates?: CustomDateRange) => {
    setDateRange(range as DateRangeFilterType);
    setCustomDates(range === 'custom' && dates ? dates : undefined);
  };

  const isLoading = bookingsLoading || agentsLoading;
  const leaderboard = calculateLeaderboard(bookings, agents, dateRange, customDates);

  const summaryStats = useMemo(() => {
    const totalBookings = leaderboard.reduce((sum, entry) => sum + entry.bookings, 0);
    const totalNew = leaderboard.reduce((sum, entry) => sum + entry.newBookings, 0);
    const totalRebooks = leaderboard.reduce((sum, entry) => sum + entry.rebookings, 0);
    const activeAgents = leaderboard.length;
    
    return { totalBookings, totalNew, totalRebooks, activeAgents };
  }, [leaderboard]);

  return (
    <DashboardLayout 
      title="Agent Leaderboard" 
      subtitle="Complete ranking of all agents by performance"
    >
      <div className="flex items-center gap-3 mb-6">
        <DateRangeFilter 
          defaultValue="today" 
          onRangeChange={handleRangeChange}
          includeAllTime={true}
          includeCustom={true}
        />
        <SiteFilter />
      </div>

      {isLoading ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        </>
      ) : leaderboard.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No agent performance data available.
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-foreground" />
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Bookings</p>
              </div>
              <p className="text-2xl font-bold text-foreground mt-1">{summaryStats.totalBookings}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {summaryStats.totalNew} new • {summaryStats.totalRebooks} rebooks
              </p>
            </div>
            
            <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" />
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">New Bookings</p>
              </div>
              <p className="text-2xl font-bold text-accent mt-1">{summaryStats.totalNew}</p>
            </div>
            
            <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-primary" />
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Rebookings</p>
              </div>
              <p className="text-2xl font-bold text-primary mt-1">{summaryStats.totalRebooks}</p>
            </div>
            
            <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-success" />
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Active Agents</p>
              </div>
              <p className="text-2xl font-bold text-success mt-1">{summaryStats.activeAgents}</p>
            </div>
          </div>

          <LeaderboardTable data={leaderboard} showAll />
        </>
      )}
    </DashboardLayout>
  );
}
