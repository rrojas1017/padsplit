import { TrendingUp, TrendingDown, Minus, Trophy, Medal } from 'lucide-react';
import { LeaderboardEntry } from '@/types';
import { cn } from '@/lib/utils';

interface LeaderboardTableProps {
  data: LeaderboardEntry[];
  showAll?: boolean;
}

export function LeaderboardTable({ data, showAll = false }: LeaderboardTableProps) {
  const displayData = showAll ? data : data.slice(0, 5);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
    return <span className="text-muted-foreground font-mono">#{rank}</span>;
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="w-4 h-4 text-success" />;
    if (change < 0) return <TrendingDown className="w-4 h-4 text-destructive" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <div className="bg-card rounded-xl border border-border shadow-card animate-slide-up" style={{ animationDelay: '300ms' }}>
      <div className="p-6 border-b border-border">
        <h3 className="text-lg font-semibold text-foreground">Agent Leaderboard</h3>
        <p className="text-sm text-muted-foreground">Top performers this week</p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rank</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Agent</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Site</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">New</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rebooks</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Per Day</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pending</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {displayData.map((entry, index) => (
              <tr 
                key={entry.agentId}
                className={cn(
                  "hover:bg-muted/30 transition-colors",
                  entry.rank <= 3 && "bg-accent/5"
                )}
              >
                <td className="py-4 px-4">
                  <div className="flex items-center justify-center w-8">
                    {getRankIcon(entry.rank)}
                  </div>
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {entry.agentName.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <span className="font-medium text-foreground">{entry.agentName}</span>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <span className={cn(
                    "px-2 py-1 rounded-full text-xs font-medium",
                    entry.siteName === 'Vixicom' 
                      ? "bg-accent/20 text-accent" 
                      : "bg-primary/20 text-primary"
                  )}>
                    {entry.siteName}
                  </span>
                </td>
                <td className="py-4 px-4 text-right">
                  <span className="font-semibold text-foreground">{entry.bookings}</span>
                </td>
                <td className="py-4 px-4 text-right">
                  <span className="font-medium text-success">{entry.newBookings}</span>
                </td>
                <td className="py-4 px-4 text-right">
                  <span className="text-muted-foreground">{entry.rebookings}</span>
                </td>
                <td className="py-4 px-4 text-right">
                  <span className="text-muted-foreground">{entry.bookingsPerDay}</span>
                </td>
                <td className="py-4 px-4 text-right">
                  <span className="text-muted-foreground">{entry.pending}</span>
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center justify-end gap-1">
                    {getChangeIcon(entry.change)}
                    <span className={cn(
                      "text-sm font-medium",
                      entry.change > 0 ? "text-success" : entry.change < 0 ? "text-destructive" : "text-muted-foreground"
                    )}>
                      {entry.change > 0 ? '+' : ''}{entry.change}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
