import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { usePageTracking } from '@/hooks/usePageTracking';
import { LeaderboardTable } from '@/components/dashboard/LeaderboardTable';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
import { SiteFilter } from '@/components/dashboard/SiteFilter';
import { useBookings } from '@/contexts/BookingsContext';
import { useAgents } from '@/contexts/AgentsContext';
import { calculateLeaderboard, DateRangeFilter as DateRangeFilterType } from '@/utils/dashboardCalculations';
import { Skeleton } from '@/components/ui/skeleton';

export default function Leaderboard() {
  usePageTracking('view_leaderboard');
  const { bookings, isLoading: bookingsLoading } = useBookings();
  const { agents, isLoading: agentsLoading } = useAgents();
  const [dateRange, setDateRange] = useState<DateRangeFilterType>('7d');

  const isLoading = bookingsLoading || agentsLoading;
  const leaderboard = calculateLeaderboard(bookings, agents, dateRange);

  return (
    <DashboardLayout 
      title="Agent Leaderboard" 
      subtitle="Complete ranking of all agents by performance"
    >
      <div className="flex items-center gap-3 mb-6">
        <DateRangeFilter 
          defaultValue="7d" 
          onRangeChange={(range) => setDateRange(range as DateRangeFilterType)} 
        />
        <SiteFilter />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No agent performance data available.
        </div>
      ) : (
        <LeaderboardTable data={leaderboard} showAll />
      )}
    </DashboardLayout>
  );
}
