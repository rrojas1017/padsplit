import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { usePageTracking } from '@/hooks/usePageTracking';
import { useAuth } from '@/contexts/AuthContext';
import { useAgents } from '@/contexts/AgentsContext';
import { useQAData, calculateQAStats } from '@/hooks/useQAData';
import { useQACoachingData } from '@/hooks/useQACoachingData';
import { useCoachingData } from '@/hooks/useCoachingData';
import { QACoachingAudioPlayer } from '@/components/qa/QACoachingAudioPlayer';
import { CoachingAudioPlayer } from '@/components/coaching/CoachingAudioPlayer';
import { BroadcastBanner } from '@/components/broadcast/BroadcastBanner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DateRangeFilter, DateFilterValue, CustomDateRange } from '@/components/dashboard/DateRangeFilter';

import { 
  ClipboardCheck, TrendingUp, Calendar, Target, Award, BarChart3, 
  Trophy, ArrowUp, ArrowDown, AlertTriangle
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { useDailyCostGate } from '@/hooks/useDailyCostGate';
import { format, isWithinInterval, startOfDay, endOfDay, startOfWeek, startOfMonth, subDays } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

export default function MyQA() {
  usePageTracking('view_my_qa');
  const { user } = useAuth();
  const { agents } = useAgents();
  const { coachingBlocked } = useDailyCostGate();
  const [dateRange, setDateRange] = useState<DateFilterValue>('today');
  const [customDates, setCustomDates] = useState<CustomDateRange | undefined>(undefined);

  const handleRangeChange = (range: DateFilterValue, dates?: CustomDateRange) => {
    setDateRange(range);
    setCustomDates(range === 'custom' && dates ? dates : undefined);
  };
  
  // Get agent ID for current user
  const myAgent = agents.find(a => a.userId === user?.id);
  const { qaBookings, rubric, isLoading } = useQAData({ 
    agentId: myAgent?.id,
    includeUnscored: false 
  });

  // Get QA coaching data
  const { qaCoachingBookings, isLoading: isCoachingLoading } = useQACoachingData({
    agentId: myAgent?.id
  });

  // Get Jeff's coaching data
  const { coachingBookingsWithAudio: jeffCoachingBookings, isLoading: isJeffCoachingLoading } = useCoachingData({
    agentId: myAgent?.id,
    includeAudio: true,
  });

  // Filter by date range
  const filteredBookings = useMemo(() => {
    if (dateRange === 'all') return qaBookings;
    
    const now = new Date();
    let startDate: Date;
    
    if (dateRange === 'custom' && customDates) {
      startDate = startOfDay(customDates.from);
      const endDate = endOfDay(customDates.to);
      return qaBookings
        .filter(b => {
          const bookingDate = new Date(b.bookingDate + 'T00:00:00');
          return isWithinInterval(bookingDate, { start: startDate, end: endDate });
        })
        .sort((a, b) => new Date(b.bookingDate + 'T00:00:00').getTime() - new Date(a.bookingDate + 'T00:00:00').getTime());
    }
    
    switch (dateRange) {
      case 'today':
        startDate = startOfDay(now);
        break;
      case 'yesterday':
        startDate = startOfDay(subDays(now, 1));
        break;
      case '7d':
        startDate = startOfDay(subDays(now, 6));
        break;
      case '30d':
        startDate = startOfDay(subDays(now, 29));
        break;
      case 'month':
        startDate = startOfMonth(now);
        break;
      default:
        startDate = new Date(0);
    }

    return qaBookings
      .filter(b => {
        const bookingDate = new Date(b.bookingDate + 'T00:00:00');
        return isWithinInterval(bookingDate, { start: startDate, end: endOfDay(now) });
      })
      .sort((a, b) => new Date(b.bookingDate + 'T00:00:00').getTime() - new Date(a.bookingDate + 'T00:00:00').getTime());
  }, [qaBookings, dateRange, customDates]);

  // Helper to find weakest category for a booking
  const getWeakestCategory = (booking: typeof qaBookings[0]) => {
    if (!booking?.qaScores?.scores || !rubric) return null;
    
    let weakest: { name: string; score: number; max: number; percentage: number } | null = null;
    
    for (const cat of rubric.categories) {
      const score = booking.qaScores.scores[cat.name] || 0;
      const max = cat.maxPoints;
      const percentage = (score / max) * 100;
      
      if (!weakest || percentage < weakest.percentage) {
        weakest = { name: cat.name, score, max, percentage };
      }
    }
    
    return weakest;
  };

  // Calculate top and lowest scored bookings
  const { topScoredBooking, lowestScoredBooking, lowestWeakestCategory } = useMemo(() => {
    const scoredBookings = filteredBookings.filter(b => b.qaScores?.percentage !== undefined);
    if (scoredBookings.length === 0) return { topScoredBooking: null, lowestScoredBooking: null, lowestWeakestCategory: null };
    
    const sorted = [...scoredBookings].sort((a, b) => 
      (b.qaScores?.percentage || 0) - (a.qaScores?.percentage || 0)
    );
    
    const top = sorted[0];
    const lowest = sorted[sorted.length - 1];
    
    // Match to coaching data (use bookingId, not transcription id)
    const topCoaching = qaCoachingBookings.find(c => c.bookingId === top.bookingId);
    const lowestCoaching = qaCoachingBookings.find(c => c.bookingId === lowest.bookingId);
    
    // Get weakest category for lowest scored booking
    const weakestCat = lowest && lowest.id !== top?.id ? getWeakestCategory(lowest) : null;
    
    return {
      topScoredBooking: top ? { ...top, coaching: topCoaching } : null,
      lowestScoredBooking: lowest && lowest.id !== top?.id ? { ...lowest, coaching: lowestCoaching } : null,
      lowestWeakestCategory: weakestCat,
    };
  }, [filteredBookings, qaCoachingBookings, rubric]);

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
      calls: data.count,
    }));
  }, [filteredBookings]);

  // Category breakdown data
  const categoryData = useMemo(() => {
    if (!rubric) return [];
    return rubric.categories.map(cat => ({
      name: cat.name.split(' ').slice(0, 2).join(' '),
      fullName: cat.name,
      avgScore: Math.round((stats.categoryAverages[cat.name] || 0) * 10) / 10,
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

  // Loading State - Simple like QADashboard
  if (isLoading) {
    return (
      <DashboardLayout title="My QA Scores" subtitle="Loading your quality scores...">
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Loading QA data...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!myAgent) {
    return (
      <DashboardLayout title="My QA Scores" subtitle="Quality assurance scores for your calls">
        <Card className="border-dashed">
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

  return (
    <DashboardLayout 
      title="My QA Scores" 
      subtitle="Quality assurance scores for your calls"
    >
      <BroadcastBanner />
      <div className="space-y-6">
        {/* Controls */}
        <div className="flex flex-wrap justify-between items-center gap-4">
          <DateRangeFilter 
            defaultValue="today"
            onRangeChange={handleRangeChange}
            includeAllTime={true}
            includeCustom={true}
          />
        </div>

        {/* Top & Lowest Scored Calls Section */}
        {topScoredBooking && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top Scored Call */}
            <Card className="border-success/30 bg-success/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-success" />
                  Your Best Call
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{topScoredBooking.memberName}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(topScoredBooking.bookingDate + 'T00:00:00'), 'MMM d, yyyy')}
                      {topScoredBooking.marketCity && ` • ${topScoredBooking.marketCity}`}
                    </p>
                  </div>
                  <Badge className="text-lg px-4 py-2 bg-success/20 text-success border-success/30" variant="outline">
                    {topScoredBooking.qaScores?.percentage || 0}%
                  </Badge>
                </div>
                <QACoachingAudioPlayer
                  bookingId={topScoredBooking.bookingId}
                  audioUrl={topScoredBooking.coaching?.qaCoachingAudioUrl || null}
                  listenedAt={topScoredBooking.coaching?.qaCoachingAudioListenedAt || null}
                  qaScore={topScoredBooking.qaScores?.percentage}
                  variant="button"
                  agentUserId={myAgent?.userId}
                />
              </CardContent>
            </Card>

            {/* Lowest Scored Call - Only show if different from top */}
            {lowestScoredBooking && (
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="w-5 h-5 text-amber-500" />
                    Focus Call
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{lowestScoredBooking.memberName}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(lowestScoredBooking.bookingDate + 'T00:00:00'), 'MMM d, yyyy')}
                        {lowestScoredBooking.marketCity && ` • ${lowestScoredBooking.marketCity}`}
                      </p>
                    </div>
                    <Badge 
                      className={`text-lg px-4 py-2 ${
                        (lowestScoredBooking.qaScores?.percentage || 0) >= 70 
                          ? 'bg-accent/20 text-accent border-accent/30'
                          : 'bg-amber-500/20 text-amber-500 border-amber-500/30'
                      }`} 
                      variant="outline"
                    >
                      {lowestScoredBooking.qaScores?.percentage || 0}%
                    </Badge>
                  </div>
                  {lowestWeakestCategory && (
                    <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
                      <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      <span className="text-sm font-medium">Focus: {lowestWeakestCategory.name}</span>
                      <Badge variant="outline" className="text-amber-500 border-amber-500/30 ml-auto">
                        {lowestWeakestCategory.score}/{lowestWeakestCategory.max}
                      </Badge>
                    </div>
                  )}
                  <QACoachingAudioPlayer
                    bookingId={lowestScoredBooking.bookingId}
                    audioUrl={lowestScoredBooking.coaching?.qaCoachingAudioUrl || null}
                    listenedAt={lowestScoredBooking.coaching?.qaCoachingAudioListenedAt || null}
                    qaScore={lowestScoredBooking.qaScores?.percentage}
                    variant="button"
                    agentUserId={myAgent?.userId}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Stats Badge */}
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Target className="w-3 h-3" />
            {stats.totalCalls} Scored Calls
          </Badge>
        </div>

        {/* Overview Cards - Match QADashboard style */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Your QA Score</p>
                  <p className={`text-3xl font-bold ${getScoreColor(stats.avgPercentage)}`}>
                    {stats.avgPercentage.toFixed(1)}%
                  </p>
                </div>
                <Award className={`w-10 h-10 ${getScoreColor(stats.avgPercentage)}`} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Points</p>
                  <p className="text-3xl font-bold text-foreground">
                    {stats.avgTotal.toFixed(1)}<span className="text-lg text-muted-foreground">/{stats.maxTotal}</span>
                  </p>
                </div>
                <Target className="w-10 h-10 text-accent" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Best Category</p>
                  <p className="text-xl font-bold text-foreground truncate">{bestCategory?.name || '—'}</p>
                  {bestCategory && <p className="text-xs text-success">{bestCategory.percentage}%</p>}
                </div>
                <ArrowUp className="w-10 h-10 text-success" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Focus Area</p>
                  <p className="text-xl font-bold text-foreground truncate">{worstCategory?.name || '—'}</p>
                  {worstCategory && <p className="text-xs text-amber-500">{worstCategory.percentage}%</p>}
                </div>
                <ArrowDown className="w-10 h-10 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent QA Scores with Katty Coaching - Card Based Layout */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy className="w-5 h-5 text-accent" />
              Recent QA Scores
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Coach Disclaimer Note */}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
              <span className="text-accent">🎙️</span>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">Note:</span> Katty (QA) and Jeff (Coach) may occasionally mispronounce some names — we apologize in advance! 😊
              </p>
            </div>

            {filteredBookings.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No scored calls yet</p>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {filteredBookings.map((booking) => {
                  const matchingCoaching = qaCoachingBookings.find(c => c.bookingId === booking.bookingId);
                  const jeffCoaching = jeffCoachingBookings.find(c => c.id === booking.bookingId);
                  const scorePercentage = booking.qaScores?.percentage || 0;
                  const hasListened = !!matchingCoaching?.qaCoachingAudioListenedAt;
                  
                  return (
                    <div 
                      key={booking.id} 
                      className="p-4 rounded-lg bg-muted/50 border border-border hover:bg-muted/70 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-4 mb-2">
                        {/* Left side - Member info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{booking.memberName}</p>
                            {hasListened && (
                              <Badge variant="outline" className="text-success border-success/30 text-xs">
                                ✓ Listened
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <span>{format(new Date(booking.bookingDate + 'T00:00:00'), 'MMM d, yyyy')}</span>
                            {booking.marketCity && (
                              <>
                                <span>•</span>
                                <span>{booking.marketCity}{booking.marketState ? `, ${booking.marketState}` : ''}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* QA Score Badge */}
                        <Badge 
                          className={`text-sm px-3 py-1 ${
                            scorePercentage >= 85 
                              ? 'bg-success/20 text-success border-success/30' 
                              : scorePercentage >= 70 
                                ? 'bg-accent/20 text-accent border-accent/30' 
                                : 'bg-destructive/20 text-destructive border-destructive/30'
                          }`}
                          variant="outline"
                        >
                          {scorePercentage}%
                        </Badge>
                      </div>

                      {/* Two-row coaching section: Katty + Jeff */}
                      <div className="flex flex-col gap-2 mt-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground w-20 flex-shrink-0">🎙️ Katty:</span>
                          {isCoachingLoading ? (
                            <span className="text-muted-foreground text-sm">Loading...</span>
                          ) : (
                            <QACoachingAudioPlayer
                              bookingId={booking.bookingId}
                              audioUrl={matchingCoaching?.qaCoachingAudioUrl || null}
                              listenedAt={matchingCoaching?.qaCoachingAudioListenedAt || null}
                              qaScore={scorePercentage}
                              variant="button"
                              agentUserId={myAgent?.userId}
                            />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground w-20 flex-shrink-0">🎧 Jeff:</span>
                          {isJeffCoachingLoading ? (
                            <span className="text-muted-foreground text-sm">Loading...</span>
                          ) : jeffCoaching ? (
                            <CoachingAudioPlayer
                              bookingId={booking.bookingId}
                              audioUrl={jeffCoaching.coachingAudioUrl || undefined}
                              variant="button"
                              listenedAt={jeffCoaching.coachingAudioListenedAt}
                              agentUserId={myAgent?.userId}
                              coachingBlocked={coachingBlocked}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground italic">No coaching yet</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Category Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="w-5 h-5 text-accent" />
                Category Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {categoryData.length === 0 || stats.totalCalls === 0 ? (
                <p className="text-center text-muted-foreground py-8">No data available</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryData} layout="vertical" margin={{ left: 10, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <YAxis 
                        type="category" 
                        dataKey="name" 
                        width={90}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload?.[0]) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-popover border border-border p-3 rounded-lg shadow-lg">
                                <p className="font-medium text-sm">{data.fullName}</p>
                                <p className="text-accent">{data.avgScore}/{data.max} pts ({data.percentage}%)</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="percentage" radius={[0, 4, 4, 0]}>
                        {categoryData.map((entry, index) => (
                          <Cell 
                            key={index} 
                            fill={entry.percentage >= 85 ? 'hsl(var(--success))' : 
                                  entry.percentage >= 70 ? 'hsl(var(--accent))' : 
                                  'hsl(var(--destructive))'} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Trend Chart */}
        {trendData.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="w-5 h-5 text-accent" />
                Score Trend Over Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="myQaScoreGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.4} />
                        <stop offset="50%" stopColor="hsl(var(--accent))" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      dy={10}
                    />
                    <YAxis 
                      domain={[0, 100]} 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v}%`}
                      width={45}
                    />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload?.[0]) {
                          const percentage = payload[0].value as number;
                          return (
                            <div className="bg-popover/95 backdrop-blur-md border border-border/50 px-4 py-3 rounded-xl shadow-xl">
                              <p className="font-semibold text-sm text-foreground">{payload[0].payload.date}</p>
                              <div className="flex items-baseline gap-1 mt-1">
                                <span className={`text-lg font-bold ${getScoreColor(percentage)}`}>{percentage}%</span>
                                <span className="text-xs text-muted-foreground">avg score</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">{payload[0].payload.calls} calls scored</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="percentage" 
                      stroke="hsl(var(--accent))" 
                      strokeWidth={2.5}
                      fill="url(#myQaScoreGradient)" 
                      dot={{ fill: 'hsl(var(--accent))', r: 4, strokeWidth: 2, stroke: 'hsl(var(--background))' }}
                      activeDot={{ r: 6, strokeWidth: 0, fill: 'hsl(var(--accent))' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
