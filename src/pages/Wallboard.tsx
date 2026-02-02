import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageTracking } from '@/hooks/usePageTracking';
import { useFullscreen } from '@/hooks/useFullscreen';
import { useBookings } from '@/contexts/BookingsContext';
import { useAgents } from '@/contexts/AgentsContext';
import { calculateLeaderboard } from '@/utils/dashboardCalculations';
import { format, subDays } from 'date-fns';
import { Trophy, TrendingUp, TrendingDown, RefreshCw, Users, Calendar, ArrowLeft, Sun, Moon, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import padsplitLogo from '@/assets/padsplit-logo.jpeg';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function Wallboard() {
  usePageTracking('view_wallboard');
  const [time, setTime] = useState(new Date());
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(60);
  const [isFlashing, setIsFlashing] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { isFullscreen, toggleFullscreen } = useFullscreen();
  const navigate = useNavigate();
  const { bookings, isLoading: bookingsLoading, refreshBookings } = useBookings();
  const { agents, sites, isLoading: agentsLoading } = useAgents();
  
  const isLoading = bookingsLoading || agentsLoading;
  
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

  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  
  // Get site IDs from database
  const vixicomSite = sites.find(s => s.name === 'Vixicom');
  const padsplitSite = sites.find(s => s.name === 'PadSplit Internal');
  
  const todayBookings = bookings.filter(b => format(new Date(b.bookingDate), 'yyyy-MM-dd') === today);
  const yesterdayBookings = bookings.filter(b => format(new Date(b.bookingDate), 'yyyy-MM-dd') === yesterday);
  
  // Same-time comparison: filter by createdAt time
  const currentHour = time.getHours();
  const currentMinutes = time.getMinutes();
  
  const createdByNow = (b: typeof bookings[0]): boolean => {
    if (!b.createdAt) return true; // Include if no timestamp
    const createdAt = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
    const createdHour = createdAt.getHours();
    const createdMinutes = createdAt.getMinutes();
    return createdHour < currentHour || 
           (createdHour === currentHour && createdMinutes <= currentMinutes);
  };
  
  const todayByNow = todayBookings.filter(createdByNow);
  const yesterdayByNow = yesterdayBookings.filter(createdByNow);
  
  const vixicomToday = todayByNow.filter(b => 
    agents.find(a => a.id === b.agentId)?.siteId === vixicomSite?.id
  ).length;
  
  const vixicomYesterday = yesterdayByNow.filter(b => 
    agents.find(a => a.id === b.agentId)?.siteId === vixicomSite?.id
  ).length;
  
  const padsplitToday = todayByNow.filter(b => 
    agents.find(a => a.id === b.agentId)?.siteId === padsplitSite?.id
  ).length;
  
  const padsplitYesterday = yesterdayByNow.filter(b => 
    agents.find(a => a.id === b.agentId)?.siteId === padsplitSite?.id
  ).length;

  const leaderboard = calculateLeaderboard(bookings, agents).slice(0, 10);

  const change = todayByNow.length - yesterdayByNow.length;
  const changePercent = yesterdayByNow.length > 0 
    ? Math.round((change / yesterdayByNow.length) * 100) 
    : (todayByNow.length > 0 ? 100 : 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 lg:p-8">
        <header className="flex items-center justify-between mb-8">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-12 w-32" />
        </header>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-background p-6 lg:p-8 flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between pb-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/dashboard')}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Button>
          <div className="h-6 w-px bg-border" />
          <img src={padsplitLogo} alt="PadSplit" className="h-10 w-auto rounded-lg" />
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Operations Dashboard</h1>
            <p className="text-muted-foreground">Live Performance View</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
                  {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isFullscreen ? 'Exit fullscreen' : 'Fit to screen'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>
          <div className="text-right">
            <p className="text-3xl lg:text-4xl font-bold text-foreground font-mono">
              {format(time, 'HH:mm:ss')}
            </p>
            <p className="text-muted-foreground">{format(time, 'EEEE, MMMM d, yyyy')}</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col gap-6 min-h-0">
        {/* Top Stats */}
        <div className="flex-shrink-0 grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Total Today */}
          <div className={cn(
            "bg-card rounded-2xl p-6 border border-border shadow-card transition-shadow",
            isFlashing && "animate-flash"
          )}>
            <div className="flex items-center justify-between mb-4">
              <Calendar className="w-8 h-8 text-accent" />
              <div className={cn(
                "flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium",
                change >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
              )}>
                {change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {change >= 0 ? '+' : ''}{changePercent}%
              </div>
            </div>
            <p className="text-5xl lg:text-6xl font-bold text-foreground">{todayByNow.length}</p>
            <p className="text-muted-foreground mt-2">Total Bookings Today</p>
            <p className="text-xs text-muted-foreground">vs {yesterdayByNow.length} at this time yesterday</p>
          </div>

          {/* Vixicom */}
          <div className={cn(
            "bg-card rounded-2xl p-6 border border-accent/30 shadow-card transition-shadow",
            isFlashing && "animate-flash"
          )}>
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-8 h-8 text-accent" />
              <span className="text-lg font-medium text-accent">Vixicom</span>
            </div>
            <p className="text-5xl lg:text-6xl font-bold text-foreground">{vixicomToday}</p>
            <p className="text-muted-foreground mt-2">Bookings</p>
            <p className="text-xs text-muted-foreground">vs {vixicomYesterday} at this time yesterday</p>
          </div>

          {/* PadSplit Internal */}
          <div className={cn(
            "bg-card rounded-2xl p-6 border border-primary/30 shadow-card transition-shadow",
            isFlashing && "animate-flash"
          )}>
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-8 h-8 text-primary" />
              <span className="text-lg font-medium text-primary">PadSplit Internal</span>
            </div>
            <p className="text-5xl lg:text-6xl font-bold text-foreground">{padsplitToday}</p>
            <p className="text-muted-foreground mt-2">Bookings</p>
            <p className="text-xs text-muted-foreground">vs {padsplitYesterday} at this time yesterday</p>
          </div>

          {/* vs Yesterday */}
          <div className={cn(
            "bg-card rounded-2xl p-6 border border-border shadow-card transition-shadow",
            isFlashing && "animate-flash"
          )}>
            <div className="flex items-center gap-2 mb-4">
              <RefreshCw className="w-8 h-8 text-muted-foreground" />
              <span className="text-lg font-medium text-muted-foreground">Yesterday</span>
            </div>
            <p className="text-5xl lg:text-6xl font-bold text-foreground">{yesterdayBookings.length}</p>
            <p className="text-muted-foreground mt-2">Bookings</p>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="flex-1 min-h-0 bg-card rounded-2xl border border-border shadow-card overflow-hidden flex flex-col">
          <div className="flex-shrink-0 p-6 border-b border-border bg-muted/30">
            <h2 className="text-xl lg:text-2xl font-bold text-foreground flex items-center gap-3">
              <Trophy className="w-6 h-6 text-accent" />
              Top Performers This Week
            </h2>
          </div>
          
          <div className="flex-1 min-h-0 p-6 overflow-auto">
            {leaderboard.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No performance data available.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {leaderboard.map((entry, index) => (
                  <div
                    key={entry.agentId}
                    className={cn(
                      "p-4 rounded-xl border transition-all",
                      index === 0 && "bg-yellow-500/10 border-yellow-500/30",
                      index === 1 && "bg-gray-400/10 border-gray-400/30",
                      index === 2 && "bg-amber-600/10 border-amber-600/30",
                      index > 2 && "bg-muted/30 border-border"
                    )}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg",
                        index === 0 && "bg-yellow-500 text-yellow-950",
                        index === 1 && "bg-gray-400 text-gray-950",
                        index === 2 && "bg-amber-600 text-amber-950",
                        index > 2 && "bg-muted text-muted-foreground"
                      )}>
                        {entry.rank}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">{entry.agentName}</p>
                        <p className="text-xs text-muted-foreground">{entry.siteName}</p>
                      </div>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-3xl font-bold text-foreground">{entry.bookings}</p>
                        <p className="text-xs text-muted-foreground">
                          {entry.newBookings} new{entry.rebookings > 0 && ` • ${entry.rebookings} rebook${entry.rebookings !== 1 ? 's' : ''}`}
                        </p>
                      </div>
                      <div className={cn(
                        "flex items-center gap-1 text-sm font-medium",
                        entry.change >= 0 ? "text-success" : "text-destructive"
                      )}>
                        {entry.change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        {entry.change >= 0 ? '+' : ''}{entry.change}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="flex-shrink-0 pt-4 text-center text-sm text-muted-foreground">
        <p className="flex items-center justify-center gap-2">
          <RefreshCw className={cn("w-4 h-4", secondsUntilRefresh <= 5 && "animate-spin")} />
          Next refresh in {secondsUntilRefresh}s • Last updated {format(lastRefresh, 'HH:mm:ss')} • Powered by Appendify LLC
        </p>
      </footer>
    </div>
  );
}
