import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { LeaderboardTable } from '@/components/dashboard/LeaderboardTable';
import { mockBookings, getLeaderboard } from '@/data/mockData';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
import { SiteFilter } from '@/components/dashboard/SiteFilter';

export default function Leaderboard() {
  const leaderboard = getLeaderboard(mockBookings);

  return (
    <DashboardLayout 
      title="Agent Leaderboard" 
      subtitle="Complete ranking of all agents by performance"
    >
      <div className="flex items-center gap-3 mb-6">
        <DateRangeFilter />
        <SiteFilter />
      </div>

      <LeaderboardTable data={leaderboard} showAll />
    </DashboardLayout>
  );
}
