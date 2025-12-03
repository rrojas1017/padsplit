import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useDisplayTokens } from '@/contexts/DisplayTokensContext';
import { useBookings } from '@/contexts/BookingsContext';
import { useAgents } from '@/contexts/AgentsContext';
import { getLeaderboard } from '@/data/mockData';
import { DisplayToken } from '@/types';
import { format, subDays } from 'date-fns';
import { Trophy, TrendingUp, TrendingDown, RefreshCw, Users, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import padsplitLogo from '@/assets/padsplit-logo.jpeg';
import appendifyLogo from '@/assets/appendify-logo.png';

export default function PublicWallboard() {
  const { token } = useParams<{ token: string }>();
  const { validateToken } = useDisplayTokens();
  const { bookings, refreshBookings } = useBookings();
  const { agents, sites } = useAgents();
  const [time, setTime] = useState(new Date());
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(60);
  const [isFlashing, setIsFlashing] = useState(false);
  const [displayToken, setDisplayToken] = useState<DisplayToken | null>(null);
  const [isValidating, setIsValidating] = useState(true);
  
  // Validate token on mount
  useEffect(() => {
    const validate = async () => {
      if (token) {
        const validatedToken = await validateToken(token);
        setDisplayToken(validatedToken);
      }
      setIsValidating(false);
    };
    validate();
  }, [token, validateToken]);

  // Clock and countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
      setSecondsUntilRefresh(prev => (prev > 1 ? prev - 1 : 60));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-refresh bookings every 60 seconds
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      refreshBookings();
      setLastRefresh(new Date());
      setSecondsUntilRefresh(60);
      // Trigger flash animation
      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 800);
    }, 60000);
    return () => clearInterval(refreshInterval);
  }, [refreshBookings]);

  if (isValidating) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Validating display link...</p>
        </div>
      </div>
    );
  }

  if (!displayToken) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Invalid or Expired Link</h1>
          <p className="text-muted-foreground">This display link is no longer valid.</p>
        </div>
      </div>
    );
  }

  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  
  // Get site IDs from database
  const vixicomSite = sites.find(s => s.name === 'Vixicom');
  const padsplitSite = sites.find(s => s.name === 'PadSplit Internal');
  
  // Filter bookings based on site filter if set
  const filteredAgentIds = displayToken.siteFilter && displayToken.siteFilter !== 'all'
    ? agents.filter(a => a.siteId === displayToken.siteFilter).map(a => a.id)
    : null;

  const filterByAgent = (booking: any) => 
    !filteredAgentIds || filteredAgentIds.includes(booking.agentId);

  const todayBookings = bookings.filter(b => 
    format(new Date(b.bookingDate), 'yyyy-MM-dd') === today && filterByAgent(b)
  );
  const yesterdayBookings = bookings.filter(b => 
    format(new Date(b.bookingDate), 'yyyy-MM-dd') === yesterday && filterByAgent(b)
  );
  
  const vixicomToday = todayBookings.filter(b => 
    agents.find(a => a.id === b.agentId)?.siteId === vixicomSite?.id
  ).length;
  
  const padsplitToday = todayBookings.filter(b => 
    agents.find(a => a.id === b.agentId)?.siteId === padsplitSite?.id
  ).length;

  const leaderboard = getLeaderboard(bookings).slice(0, 10);

  const change = todayBookings.length - yesterdayBookings.length;
  const changePercent = yesterdayBookings.length > 0 
    ? Math.round((change / yesterdayBookings.length) * 100) 
    : 0;

  return (
    <div className="h-screen overflow-hidden bg-background p-4 lg:p-6 flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between pb-4">
        <div className="flex items-center gap-4">
          <img src={padsplitLogo} alt="PadSplit" className="h-8 lg:h-10 w-auto rounded-lg" />
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-foreground">Operations Dashboard</h1>
            <p className="text-sm text-muted-foreground">Live Performance View • {displayToken.name}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl lg:text-3xl font-bold text-foreground font-mono">
            {format(time, 'HH:mm:ss')}
          </p>
          <p className="text-sm text-muted-foreground">{format(time, 'EEEE, MMMM d, yyyy')}</p>
        </div>
      </header>

      {/* Main Content - fills remaining space */}
      <div className="flex-1 flex flex-col gap-4 min-h-0">
        {/* Top Stats */}
        <div className="flex-shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          {/* Total Today */}
          <div className={cn(
            "bg-card rounded-xl p-4 lg:p-5 border border-border shadow-card transition-shadow",
            isFlashing && "animate-flash"
          )}>
            <div className="flex items-center justify-between mb-2">
              <Calendar className="w-6 h-6 text-accent" />
              <div className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                change >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
              )}>
                {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {change >= 0 ? '+' : ''}{changePercent}%
              </div>
            </div>
            <p className="text-4xl lg:text-5xl font-bold text-foreground">{todayBookings.length}</p>
            <p className="text-xs lg:text-sm text-muted-foreground mt-1">Total Bookings Today</p>
          </div>

          {/* Vixicom */}
          <div className={cn(
            "bg-card rounded-xl p-4 lg:p-5 border border-accent/30 shadow-card transition-shadow",
            isFlashing && "animate-flash"
          )}>
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-6 h-6 text-accent" />
              <span className="text-sm font-medium text-accent">Vixicom</span>
            </div>
            <p className="text-4xl lg:text-5xl font-bold text-foreground">{vixicomToday}</p>
            <p className="text-xs lg:text-sm text-muted-foreground mt-1">Bookings</p>
          </div>

          {/* PadSplit Internal */}
          <div className={cn(
            "bg-card rounded-xl p-4 lg:p-5 border border-primary/30 shadow-card transition-shadow",
            isFlashing && "animate-flash"
          )}>
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-6 h-6 text-primary" />
              <span className="text-sm font-medium text-primary">PadSplit Internal</span>
            </div>
            <p className="text-4xl lg:text-5xl font-bold text-foreground">{padsplitToday}</p>
            <p className="text-xs lg:text-sm text-muted-foreground mt-1">Bookings</p>
          </div>

          {/* vs Yesterday */}
          <div className={cn(
            "bg-card rounded-xl p-4 lg:p-5 border border-border shadow-card transition-shadow",
            isFlashing && "animate-flash"
          )}>
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="w-6 h-6 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Yesterday</span>
            </div>
            <p className="text-4xl lg:text-5xl font-bold text-foreground">{yesterdayBookings.length}</p>
            <p className="text-xs lg:text-sm text-muted-foreground mt-1">Bookings</p>
          </div>
        </div>

        {/* Leaderboard - fills remaining space */}
        <div className="flex-1 min-h-0 bg-card rounded-xl border border-border shadow-card overflow-hidden flex flex-col">
          <div className="flex-shrink-0 px-4 lg:px-6 py-3 border-b border-border bg-muted/30">
            <h2 className="text-lg lg:text-xl font-bold text-foreground flex items-center gap-2">
              <Trophy className="w-5 h-5 text-accent" />
              Top Performers This Week
            </h2>
          </div>
          
          <div className="flex-1 min-h-0 p-3 lg:p-4 overflow-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {leaderboard.map((entry, index) => (
                <div
                  key={entry.agentId}
                  className={cn(
                    "p-3 lg:p-4 rounded-lg border transition-all",
                    index === 0 && "bg-yellow-500/10 border-yellow-500/30",
                    index === 1 && "bg-gray-400/10 border-gray-400/30",
                    index === 2 && "bg-amber-600/10 border-amber-600/30",
                    index > 2 && "bg-muted/30 border-border"
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
                      index === 0 && "bg-yellow-500 text-yellow-950",
                      index === 1 && "bg-gray-400 text-gray-950",
                      index === 2 && "bg-amber-600 text-amber-950",
                      index > 2 && "bg-muted text-muted-foreground"
                    )}>
                      {entry.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{entry.agentName}</p>
                      <p className="text-xs text-muted-foreground">{entry.siteName}</p>
                    </div>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-2xl lg:text-3xl font-bold text-foreground">{entry.bookings}</p>
                      <p className="text-xs text-muted-foreground">bookings</p>
                    </div>
                    <div className={cn(
                      "flex items-center gap-0.5 text-xs font-medium",
                      entry.change >= 0 ? "text-success" : "text-destructive"
                    )}>
                      {entry.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {entry.change >= 0 ? '+' : ''}{entry.change}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="flex-shrink-0 pt-3 text-center text-xs text-muted-foreground">
        <p className="flex items-center justify-center gap-2">
          <RefreshCw className={cn("w-3 h-3", secondsUntilRefresh <= 5 && "animate-spin")} />
          Next refresh in {secondsUntilRefresh}s • Last updated {format(lastRefresh, 'HH:mm:ss')} • Powered by Appendify LLC
        </p>
      </footer>
    </div>
  );
}
