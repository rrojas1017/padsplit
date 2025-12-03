import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockBookings, getLeaderboard, mockAgents } from '@/data/mockData';
import { format, subDays } from 'date-fns';
import { Trophy, TrendingUp, TrendingDown, RefreshCw, Users, Calendar, ArrowLeft, Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import padsplitLogo from '@/assets/padsplit-logo.jpeg';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';

export default function Wallboard() {
  const [time, setTime] = useState(new Date());
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  
  const todayBookings = mockBookings.filter(b => format(b.bookingDate, 'yyyy-MM-dd') === today);
  const yesterdayBookings = mockBookings.filter(b => format(b.bookingDate, 'yyyy-MM-dd') === yesterday);
  
  const vixicomToday = todayBookings.filter(b => 
    mockAgents.find(a => a.id === b.agentId)?.siteId === 'site-1'
  ).length;
  
  const padsplitToday = todayBookings.filter(b => 
    mockAgents.find(a => a.id === b.agentId)?.siteId === 'site-2'
  ).length;

  const leaderboard = getLeaderboard(mockBookings).slice(0, 10);

  const change = todayBookings.length - yesterdayBookings.length;
  const changePercent = yesterdayBookings.length > 0 
    ? Math.round((change / yesterdayBookings.length) * 100) 
    : 0;

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
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

      {/* Top Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-8">
        {/* Total Today */}
        <div className="bg-card rounded-2xl p-6 border border-border shadow-card">
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
          <p className="text-5xl lg:text-6xl font-bold text-foreground">{todayBookings.length}</p>
          <p className="text-muted-foreground mt-2">Total Bookings Today</p>
        </div>

        {/* Vixicom */}
        <div className="bg-card rounded-2xl p-6 border border-accent/30 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-8 h-8 text-accent" />
            <span className="text-lg font-medium text-accent">Vixicom</span>
          </div>
          <p className="text-5xl lg:text-6xl font-bold text-foreground">{vixicomToday}</p>
          <p className="text-muted-foreground mt-2">Bookings</p>
        </div>

        {/* PadSplit Internal */}
        <div className="bg-card rounded-2xl p-6 border border-primary/30 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-8 h-8 text-primary" />
            <span className="text-lg font-medium text-primary">PadSplit Internal</span>
          </div>
          <p className="text-5xl lg:text-6xl font-bold text-foreground">{padsplitToday}</p>
          <p className="text-muted-foreground mt-2">Bookings</p>
        </div>

        {/* vs Yesterday */}
        <div className="bg-card rounded-2xl p-6 border border-border shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <RefreshCw className="w-8 h-8 text-muted-foreground" />
            <span className="text-lg font-medium text-muted-foreground">Yesterday</span>
          </div>
          <p className="text-5xl lg:text-6xl font-bold text-foreground">{yesterdayBookings.length}</p>
          <p className="text-muted-foreground mt-2">Bookings</p>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
        <div className="p-6 border-b border-border bg-muted/30">
          <h2 className="text-xl lg:text-2xl font-bold text-foreground flex items-center gap-3">
            <Trophy className="w-6 h-6 text-accent" />
            Top Performers This Week
          </h2>
        </div>
        
        <div className="p-6">
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
                    <p className="text-xs text-muted-foreground">bookings</p>
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
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-8 text-center text-sm text-muted-foreground">
        <p>Auto-refreshes every 60 seconds • Powered by Vixicom</p>
      </footer>
    </div>
  );
}
