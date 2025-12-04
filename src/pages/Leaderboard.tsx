import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { LeaderboardTable } from '@/components/dashboard/LeaderboardTable';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
import { SiteFilter } from '@/components/dashboard/SiteFilter';
import { useBookings } from '@/contexts/BookingsContext';
import { useAgents } from '@/contexts/AgentsContext';
import { calculateLeaderboard } from '@/utils/dashboardCalculations';
import { Skeleton } from '@/components/ui/skeleton';

export default function Leaderboard() {
  const { bookings, isLoading: bookingsLoading } = useBookings();
  const { agents, isLoading: agentsLoading } = useAgents();

  const isLoading = bookingsLoading || agentsLoading;
  const leaderboard = calculateLeaderboard(bookings, agents);

  return (
    <DashboardLayout 
      title="Agent Leaderboard" 
      subtitle="Complete ranking of all agents by performance"
    >
      <div className="flex items-center gap-3 mb-6">
        <DateRangeFilter />
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
