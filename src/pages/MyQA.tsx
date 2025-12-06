import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { usePageTracking } from '@/hooks/usePageTracking';
import { useAuth } from '@/contexts/AuthContext';
import { useAgents } from '@/contexts/AgentsContext';
import { useQAData, calculateQAStats, QABooking } from '@/hooks/useQAData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { 
  ClipboardCheck, TrendingUp, Calendar, Target, Award, BarChart3, 
  Trophy, Star, AlertTriangle, CheckCircle2, Sparkles, ArrowUp, ArrowDown
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { format, isWithinInterval, startOfDay, endOfDay, startOfWeek, startOfMonth } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, Area, AreaChart } from 'recharts';

type DateRange = 'today' | 'week' | 'month' | 'all';

export default function MyQA() {
  usePageTracking('view_my_qa');
  const { user } = useAuth();
  const { agents } = useAgents();
  const [dateRange, setDateRange] = useState<DateRange>('month');
  
  // Get agent ID for current user
  const myAgent = agents.find(a => a.userId === user?.id);
  const { qaBookings, rubric, isLoading } = useQAData({ 
    agentId: myAgent?.id,
    includeUnscored: false 
  });

  // Filter by date range
  const filteredBookings = useMemo(() => {
    if (dateRange === 'all') return qaBookings;
    
    const now = new Date();
    let startDate: Date;
    
    switch (dateRange) {
      case 'today':
        startDate = startOfDay(now);
        break;
      case 'week':
        startDate = startOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'month':
        startDate = startOfMonth(now);
        break;
      default:
        startDate = new Date(0);
    }

    return qaBookings.filter(b => {
      const bookingDate = new Date(b.bookingDate + 'T00:00:00');
      return isWithinInterval(bookingDate, { start: startDate, end: endOfDay(now) });
    });
  }, [qaBookings, dateRange]);

  const stats = calculateQAStats(filteredBookings, rubric);

  // Calculate trend data for chart
  const trendData = useMemo(() => {
    const sortedBookings = [...filteredBookings]
      .filter(b => b.qaScores)
      .sort((a, b) => new Date(a.bookingDate).getTime() - new Date(b.bookingDate).getTime());
    
    const dailyData: Record<string, { total: number; count: number }> = {};
    
    for (const booking of sortedBookings) {
      const date = booking.bookingDate;
      if (!dailyData[date]) {
        dailyData[date] = { total: 0, count: 0 };
      }
      dailyData[date].total += booking.qaScores?.percentage || 0;
      dailyData[date].count++;
    }

    return Object.entries(dailyData).map(([date, data]) => ({
      date: format(new Date(date + 'T00:00:00'), 'MMM d'),
      percentage: Math.round(data.total / data.count),
    }));
  }, [filteredBookings]);

  // Category breakdown data
  const categoryData = useMemo(() => {
    if (!rubric) return [];
    return rubric.categories.map(cat => ({
      name: cat.name.split(' ').slice(0, 2).join(' '),
      fullName: cat.name,
      score: Math.round((stats.categoryAverages[cat.name] || 0) * 10) / 10,
      max: cat.maxPoints,
      percentage: Math.round(((stats.categoryAverages[cat.name] || 0) / cat.maxPoints) * 100),
    }));
  }, [rubric, stats.categoryAverages]);

  // Find best and worst categories
  const bestCategory = categoryData.length > 0 
    ? categoryData.reduce((best, cat) => cat.percentage > best.percentage ? cat : best, categoryData[0])
    : null;
  const worstCategory = categoryData.length > 0 
    ? categoryData.reduce((worst, cat) => cat.percentage < worst.percentage ? cat : worst, categoryData[0])
    : null;

  const getScoreColor = (percentage: number) => {
    if (percentage >= 85) return 'text-success';
    if (percentage >= 70) return 'text-accent';
    return 'text-destructive';
  };

  const getScoreBgColor = (percentage: number) => {
    if (percentage >= 85) return 'bg-success/20 border-success/30';
    if (percentage >= 70) return 'bg-accent/20 border-accent/30';
    return 'bg-destructive/20 border-destructive/30';
  };

  const getScoreBadge = (percentage: number) => {
    if (percentage >= 90) return { label: 'Excellent', variant: 'default' as const, icon: Trophy };
    if (percentage >= 80) return { label: 'Good', variant: 'secondary' as const, icon: Star };
    if (percentage >= 70) return { label: 'Average', variant: 'outline' as const, icon: CheckCircle2 };
    return { label: 'Needs Work', variant: 'destructive' as const, icon: AlertTriangle };
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 85) return 'bg-success';
    if (percentage >= 70) return 'bg-accent';
    return 'bg-destructive';
  };

  // Loading State with Skeletons
  if (isLoading) {
    return (
      <DashboardLayout title="My QA Scores" subtitle="Quality assurance scores for your calls">
        <div className="space-y-6">
          {/* Hero Skeleton */}
          <Skeleton className="h-48 w-full rounded-2xl" />
          
          {/* KPI Cards Skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          
          {/* Charts Skeleton */}
          <div className="grid md:grid-cols-2 gap-6">
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
          
          {/* List Skeleton */}
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </DashboardLayout>
    );
  }

  if (!myAgent) {
    return (
      <DashboardLayout title="My QA Scores" subtitle="Quality assurance scores for your calls">
        <Card className="border-dashed shadow-card">
          <CardContent className="py-16 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted/50 flex items-center justify-center">
              <ClipboardCheck className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No Agent Profile Found</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Your account isn't linked to an agent profile yet. Contact your supervisor to set this up.
            </p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const scoreBadgeInfo = getScoreBadge(stats.avgPercentage);
  const ScoreBadgeIcon = scoreBadgeInfo.icon;

  return (
    <DashboardLayout 
      title="My QA Scores" 
      subtitle="Quality assurance scores for your calls"
    >
      <div className="space-y-6">
        {/* Period Selector */}
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Badge variant="secondary" className="gap-1.5 py-1.5 px-3">
            <Target className="w-3.5 h-3.5" />
            {stats.totalCalls} Scored Calls
          </Badge>
        </div>
        {/* Hero Score Banner */}
        <div 
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-accent/10 border border-primary/20 p-8 animate-fade-in"
        >
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-accent/20 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-primary/15 to-transparent rounded-full blur-2xl translate-y-1/2 -translate-x-1/4" />
          
          <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-accent" />
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Your QA Score</p>
              </div>
              
              {stats.totalCalls > 0 ? (
                <>
                  <div className="flex items-baseline gap-3 mb-3">
                    <span className={`text-6xl md:text-7xl font-bold tracking-tight ${getScoreColor(stats.avgPercentage)}`}>
                      {stats.avgPercentage.toFixed(0)}
                    </span>
                    <span className="text-3xl text-muted-foreground font-light">%</span>
                  </div>
                  <p className="text-muted-foreground mb-4">
                    {stats.avgTotal.toFixed(1)} / {stats.maxTotal} points average
                  </p>
                  <Badge 
                    variant={scoreBadgeInfo.variant} 
                    className="gap-1.5 px-4 py-1.5 text-sm font-medium"
                  >
                    <ScoreBadgeIcon className="w-4 h-4" />
                    {scoreBadgeInfo.label}
                  </Badge>
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-2xl font-medium text-muted-foreground">No scores yet</p>
                  <p className="text-sm text-muted-foreground/70">Complete calls to see your QA scores</p>
                </div>
              )}
            </div>
            
            <div className="flex-shrink-0">
              <div className={`w-28 h-28 rounded-full flex items-center justify-center ${
                stats.totalCalls > 0 ? getScoreBgColor(stats.avgPercentage) : 'bg-muted/30'
              } border-2 transition-all duration-500`}>
                <Award className={`w-14 h-14 ${stats.totalCalls > 0 ? getScoreColor(stats.avgPercentage) : 'text-muted-foreground/50'}`} />
              </div>
            </div>
          </div>
        </div>

        {/* KPI Cards Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Average Score */}
          <Card className="shadow-card border-border/50 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Target className="w-5 h-5 text-primary" />
                </div>
              </div>
              <p className="text-2xl font-bold">{stats.avgPercentage.toFixed(0)}%</p>
              <p className="text-xs text-muted-foreground mt-1">Average Score</p>
            </CardContent>
          </Card>
          
          {/* Total Calls */}
          <Card className="shadow-card border-border/50 animate-fade-in" style={{ animationDelay: '0.15s' }}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <ClipboardCheck className="w-5 h-5 text-accent" />
                </div>
              </div>
              <p className="text-2xl font-bold">{stats.totalCalls}</p>
              <p className="text-xs text-muted-foreground mt-1">Scored Calls</p>
            </CardContent>
          </Card>
          
          {/* Best Category */}
          <Card className="shadow-card border-border/50 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <ArrowUp className="w-5 h-5 text-success" />
                </div>
              </div>
              <p className="text-lg font-bold truncate">{bestCategory?.name || '—'}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Best Category {bestCategory ? `(${bestCategory.percentage}%)` : ''}
              </p>
            </CardContent>
          </Card>
          
          {/* Improvement Area */}
          <Card className="shadow-card border-border/50 animate-fade-in" style={{ animationDelay: '0.25s' }}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <ArrowDown className="w-5 h-5 text-amber-500" />
                </div>
              </div>
              <p className="text-lg font-bold truncate">{worstCategory?.name || '—'}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Focus Area {worstCategory ? `(${worstCategory.percentage}%)` : ''}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Category Breakdown */}
          <Card className="shadow-card animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <BarChart3 className="w-5 h-5 text-accent" />
                Score by Category
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {categoryData.length > 0 && stats.totalCalls > 0 ? (
                <div className="space-y-4">
                  {categoryData.map((cat, idx) => (
                    <div key={cat.name} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium truncate max-w-[60%]">{cat.fullName}</span>
                        <span className={`font-semibold ${getScoreColor(cat.percentage)}`}>
                          {cat.percentage}%
                        </span>
                      </div>
                      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-700 ${getProgressColor(cat.percentage)}`}
                          style={{ 
                            width: `${cat.percentage}%`,
                            animationDelay: `${idx * 0.1}s`
                          }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {cat.score} / {cat.max} points
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                  No category data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Score Trend Chart */}
          <Card className="shadow-card animate-fade-in" style={{ animationDelay: '0.35s' }}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <TrendingUp className="w-5 h-5 text-accent" />
                Score Trend
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {trendData.length > 1 ? (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="qaScoreGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 11 }} 
                        axisLine={false}
                        tickLine={false}
                        dy={10}
                      />
                      <YAxis 
                        domain={[0, 100]} 
                        tick={{ fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload?.[0]) {
                            return (
                              <div className="bg-popover/95 backdrop-blur-sm border border-border p-3 rounded-xl shadow-lg">
                                <p className="font-medium text-sm">{payload[0].payload.date}</p>
                                <p className="text-primary text-lg font-bold">{payload[0].value}%</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="percentage" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2.5}
                        fill="url(#qaScoreGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-56 flex flex-col items-center justify-center text-muted-foreground">
                  <TrendingUp className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm">Need 2+ days of data for trends</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent QA Scores */}
        <Card className="shadow-card animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <ClipboardCheck className="w-5 h-5 text-accent" />
              Recent QA Scores
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {filteredBookings.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                  <ClipboardCheck className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <h4 className="font-medium mb-1">No QA Scores Yet</h4>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Scores are generated after your calls are transcribed and analyzed.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {filteredBookings
                  .sort((a, b) => new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime())
                  .map((booking, idx) => (
                    <div 
                      key={booking.id}
                      className="group flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card hover:bg-muted/30 hover:border-border transition-all duration-200 cursor-default animate-fade-in"
                      style={{ animationDelay: `${0.05 * idx}s` }}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        {/* Score Circle */}
                        <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold ${
                          booking.qaScores 
                            ? getScoreBgColor(booking.qaScores.percentage) 
                            : 'bg-muted border-muted'
                        } border-2`}>
                          {booking.qaScores ? (
                            <span className={getScoreColor(booking.qaScores.percentage)}>
                              {booking.qaScores.percentage}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </div>
                        
                        <div className="min-w-0">
                          <p className="font-medium truncate">{booking.memberName}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {format(new Date(booking.bookingDate + 'T00:00:00'), 'MMM d, yyyy')}
                            {booking.marketCity && (
                              <span className="hidden sm:inline"> • {booking.marketCity}, {booking.marketState}</span>
                            )}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {booking.qaScores ? (
                          <>
                            <div className="hidden sm:block text-right">
                              <p className="text-xs text-muted-foreground">
                                {booking.qaScores.total}/{booking.qaScores.maxTotal} pts
                              </p>
                            </div>
                            <Badge 
                              variant={getScoreBadge(booking.qaScores.percentage).variant}
                              className="hidden md:inline-flex"
                            >
                              {getScoreBadge(booking.qaScores.percentage).label}
                            </Badge>
                          </>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Pending
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
