import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { usePageTracking } from '@/hooks/usePageTracking';
import { useAuth } from '@/contexts/AuthContext';
import { useAgents } from '@/contexts/AgentsContext';
import { useQAData, calculateQAStats, getAgentQARankings, QABooking } from '@/hooks/useQAData';
import { useQACoachingData, calculateQACoachingEngagement, getAgentQACoachingStats } from '@/hooks/useQACoachingData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DateRangeFilter, DateFilterValue, CustomDateRange } from '@/components/dashboard/DateRangeFilter';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ClipboardCheck, TrendingUp, Calendar, Target, Award, BarChart3, 
  Users, Trophy, ChevronRight, Loader2, Zap, Headphones, Volume2, CheckCircle
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { useDailyCostGate } from '@/hooks/useDailyCostGate';
import { format, isWithinInterval, startOfDay, endOfDay, startOfWeek, startOfMonth, subDays } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { QACoachingAudioPlayer } from '@/components/qa/QACoachingAudioPlayer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type DateRange = 'today' | 'week' | 'month' | 'all';

export default function QADashboard() {
  usePageTracking('view_qa_dashboard');
  const { user, hasRole } = useAuth();
  const { agents } = useAgents();
  const { coachingBlocked } = useDailyCostGate();
  const [dateRange, setDateRange] = useState<DateFilterValue>('today');
  const [customDates, setCustomDates] = useState<CustomDateRange | undefined>(undefined);
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [isBatchScoring, setIsBatchScoring] = useState(false);
  const [selectedAgentForModal, setSelectedAgentForModal] = useState<string | null>(null);

  const handleRangeChange = (range: DateFilterValue, dates?: CustomDateRange) => {
    setDateRange(range);
    setCustomDates(range === 'custom' && dates ? dates : undefined);
  };
  
  const { qaBookings, rubric, isLoading } = useQAData({ includeUnscored: true });
  const { qaCoachingBookings, isLoading: isCoachingLoading } = useQACoachingData();

  // Filter by date range and agent
  const filteredBookings = useMemo(() => {
    let filtered = qaBookings;
    
    if (selectedAgent !== 'all') {
      filtered = filtered.filter(b => b.agentId === selectedAgent);
    }
    
    if (dateRange === 'all') return filtered;
    
    const now = new Date();
    let startDate: Date;
    let endDate = endOfDay(now);
    
    if (dateRange === 'custom' && customDates) {
      startDate = startOfDay(customDates.from);
      endDate = endOfDay(customDates.to);
    } else {
      switch (dateRange) {
        case 'today':
          startDate = startOfDay(now);
          break;
        case 'yesterday':
          startDate = startOfDay(subDays(now, 1));
          endDate = endOfDay(subDays(now, 1));
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
    }

    return filtered.filter(b => {
      const bookingDate = new Date(b.bookingDate + 'T00:00:00');
      return isWithinInterval(bookingDate, { start: startDate, end: endDate });
    });
  }, [qaBookings, dateRange, selectedAgent, customDates]);

  const stats = calculateQAStats(filteredBookings, rubric);
  const rankings = getAgentQARankings(filteredBookings);

  // Get unique agents with scores
  const agentsWithScores = useMemo(() => {
    const agentIds = new Set(qaBookings.map(b => b.agentId));
    return agents.filter(a => agentIds.has(a.id));
  }, [qaBookings, agents]);

  // Filter QA coaching bookings by date range (same logic as filteredBookings)
  const filteredCoachingBookings = useMemo(() => {
    let filtered = qaCoachingBookings;
    
    if (selectedAgent !== 'all') {
      filtered = filtered.filter(b => b.agentId === selectedAgent);
    }
    
    if (dateRange === 'all') return filtered;
    
    const now = new Date();
    let startDate: Date;
    let endDate = endOfDay(now);
    
    if (dateRange === 'custom' && customDates) {
      startDate = startOfDay(customDates.from);
      endDate = endOfDay(customDates.to);
    } else {
      switch (dateRange) {
        case 'today':
          startDate = startOfDay(now);
          break;
        case 'yesterday':
          startDate = startOfDay(subDays(now, 1));
          endDate = endOfDay(subDays(now, 1));
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
    }
    
    return filtered.filter(b => {
      const bookingDate = b.bookingDate;
      return isWithinInterval(bookingDate, { start: startDate, end: endDate });
    });
  }, [qaCoachingBookings, dateRange, selectedAgent, customDates]);

  // QA Coaching engagement stats (now using filtered data)
  const coachingEngagement = useMemo(() => 
    calculateQACoachingEngagement(filteredCoachingBookings), 
    [filteredCoachingBookings]
  );

  const agentCoachingStats = useMemo(() => 
    getAgentQACoachingStats(filteredCoachingBookings, agents),
    [filteredCoachingBookings, agents]
  );

  // Get selected agent's coaching bookings for modal (using filtered data)
  const selectedAgentCoachingBookings = useMemo(() => {
    if (!selectedAgentForModal) return [];
    return filteredCoachingBookings.filter(b => b.agentId === selectedAgentForModal);
  }, [filteredCoachingBookings, selectedAgentForModal]);

  const selectedAgentName = useMemo(() => {
    if (!selectedAgentForModal) return '';
    return agents.find(a => a.id === selectedAgentForModal)?.name || '';
  }, [selectedAgentForModal, agents]);

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

  // Trend data
  const trendData = useMemo(() => {
    const scoredBookings = filteredBookings.filter(b => b.qaScores);
    const dailyData: Record<string, { total: number; count: number }> = {};
    
    for (const booking of scoredBookings) {
      const date = booking.bookingDate;
      if (!dailyData[date]) {
        dailyData[date] = { total: 0, count: 0 };
      }
      dailyData[date].total += booking.qaScores?.percentage || 0;
      dailyData[date].count++;
    }

    return Object.entries(dailyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date: format(new Date(date + 'T00:00:00'), 'MMM d'),
        percentage: Math.round(data.total / data.count),
        calls: data.count,
      }));
  }, [filteredBookings]);

  const handleBatchScore = async () => {
    setIsBatchScoring(true);
    toast.info('Starting batch QA scoring...', { duration: 5000 });
    
    try {
      const { data, error } = await supabase.functions.invoke('batch-generate-qa-scores');
      
      if (error) throw error;
      
      toast.success('Batch QA scoring started. Refresh in a few minutes to see results.', { duration: 10000 });
    } catch (error) {
      console.error('Batch scoring error:', error);
      toast.error('Failed to start batch scoring');
    } finally {
      setIsBatchScoring(false);
    }
  };

  const getScoreColor = (percentage: number) => {
    if (percentage >= 85) return 'text-success';
    if (percentage >= 70) return 'text-accent';
    return 'text-destructive';
  };

  const unscoredCount = qaBookings.filter(b => !b.qaScores).length;

  if (isLoading) {
    return (
      <DashboardLayout title="QA Dashboard" subtitle="Loading quality scores...">
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Loading QA data...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      title="QA Dashboard" 
      subtitle="Team quality assurance performance"
    >
      <div className="space-y-6">
        {/* Controls */}
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <DateRangeFilter 
              defaultValue="today"
              onRangeChange={handleRangeChange}
              includeAllTime={true}
              includeCustom={true}
            />
            
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger className="w-[180px]">
                <Users className="w-4 h-4 mr-2" />
                <SelectValue placeholder="All Agents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                {agentsWithScores.map(agent => (
                  <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            {unscoredCount > 0 && hasRole(['super_admin', 'admin']) && (
              <Button 
                onClick={handleBatchScore} 
                disabled={isBatchScoring}
                variant="outline"
                className="gap-2"
              >
                {isBatchScoring ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Scoring...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Score {unscoredCount} Calls
                  </>
                )}
              </Button>
            )}
            <Badge variant="outline" className="gap-1">
              <Target className="w-3 h-3" />
              {stats.totalCalls} Scored Calls
            </Badge>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Team QA Score</p>
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
                  <p className="text-sm text-muted-foreground">Scored Calls</p>
                  <p className="text-3xl font-bold text-foreground">{stats.totalCalls}</p>
                </div>
                <ClipboardCheck className="w-10 h-10 text-accent" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Agents Ranked</p>
                  <p className="text-3xl font-bold text-foreground">{rankings.length}</p>
                </div>
                <Users className="w-10 h-10 text-accent" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Katty's QA Coaching Engagement Card */}
        <Card className="bg-gradient-to-r from-pink-500/10 to-purple-500/10 border-pink-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Volume2 className="w-5 h-5 text-pink-500" />
              Katty's QA Coaching Engagement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Overall Listened</p>
                <p className={`text-2xl font-bold ${coachingEngagement.listenedPercentage >= 80 ? 'text-green-500' : coachingEngagement.listenedPercentage >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                  {coachingEngagement.listenedPercentage}%
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Audios Listened</p>
                <p className="text-2xl font-bold text-foreground">
                  {coachingEngagement.listened}<span className="text-lg text-muted-foreground">/{coachingEngagement.totalWithAudio}</span>
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Listens</p>
                <p className="text-2xl font-bold text-amber-500">{coachingEngagement.pending}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Most Engaged</p>
                <p className="text-xl font-bold text-foreground">
                  {agentCoachingStats[0]?.agentName || '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rolling Info Banner for QA Coaching */}
        <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-pink-500/10 border border-pink-500/20 mb-4 w-full h-12">
          <div className="absolute flex animate-marquee hover-pause whitespace-nowrap py-3 px-4">
            {/* Content repeated twice for seamless loop */}
            <div className="flex items-center gap-4 mx-8">
              <Volume2 className="w-5 h-5 text-pink-500 flex-shrink-0" />
              <span className="text-sm text-foreground font-medium">
                💡 Tip: Click the arrow (→) on any agent row to open their QA details, then scroll down to play Katty's QA coaching audio for each call
              </span>
              <span className="text-pink-500">•</span>
              <span className="text-sm text-muted-foreground">
                Agents can access their personal QA scores and coaching via the "My QA" page
              </span>
              <span className="text-pink-500">•</span>
            </div>
            {/* Duplicate for seamless loop */}
            <div className="flex items-center gap-4 mx-8">
              <Volume2 className="w-5 h-5 text-pink-500 flex-shrink-0" />
              <span className="text-sm text-foreground font-medium">
                💡 Tip: Click the arrow (→) on any agent row to open their QA details, then scroll down to play Katty's QA coaching audio for each call
              </span>
              <span className="text-pink-500">•</span>
              <span className="text-sm text-muted-foreground">
                Agents can access their personal QA scores and coaching via the "My QA" page
              </span>
              <span className="text-pink-500">•</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Agent Leaderboard */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trophy className="w-5 h-5 text-accent" />
                Agent QA Rankings
              </CardTitle>
            </CardHeader>
            <CardContent>
              {rankings.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No scored calls yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead className="text-center">Calls</TableHead>
                      <TableHead className="text-center">Score</TableHead>
                      <TableHead className="text-center">QA Coaching</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rankings.slice(0, 10).map((agent, index) => {
                      const coachingStats = agentCoachingStats.find(s => s.agentId === agent.agentId);
                      const listenedPct = coachingStats?.percentage || 0;
                      return (
                        <TableRow key={agent.agentId}>
                          <TableCell>
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                          </TableCell>
                          <TableCell className="font-medium">{agent.agentName}</TableCell>
                          <TableCell className="text-center">{agent.callCount}</TableCell>
                          <TableCell className="text-center">
                            <span className={`font-bold ${getScoreColor(agent.avgPercentage)}`}>
                              {agent.avgPercentage}%
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            {coachingStats && coachingStats.totalWithAudio > 0 ? (
                              <Badge 
                                variant="outline" 
                                className={`${listenedPct >= 80 ? 'bg-green-500/10 text-green-600 border-green-500/20' : 
                                  listenedPct >= 50 ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 
                                  'bg-red-500/10 text-red-600 border-red-500/20'}`}
                              >
                                {coachingStats.listened}/{coachingStats.totalWithAudio} ({listenedPct}%)
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              onClick={() => setSelectedAgentForModal(agent.agentId)}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

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
          <Card className="shadow-card">
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
                      <linearGradient id="qaDashboardGradient" x1="0" y1="0" x2="0" y2="1">
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
                      fill="url(#qaDashboardGradient)" 
                      dot={{ fill: 'hsl(var(--accent))', r: 4, strokeWidth: 2, stroke: 'hsl(var(--background))' }}
                      activeDot={{ r: 7, strokeWidth: 3, fill: 'hsl(var(--accent))', stroke: 'hsl(var(--background))' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Scores Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardCheck className="w-5 h-5 text-accent" />
              Recent QA Scores
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredBookings.filter(b => b.qaScores).length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No scored calls for this period</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Member</TableHead>
                      <TableHead>Market</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBookings
                      .filter(b => b.qaScores)
                      .sort((a, b) => new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime())
                      .slice(0, 20)
                      .map(booking => (
                        <TableRow key={booking.id}>
                          <TableCell>{format(new Date(booking.bookingDate + 'T00:00:00'), 'MMM d, yyyy')}</TableCell>
                          <TableCell className="font-medium">{booking.agentName}</TableCell>
                          <TableCell>{booking.memberName}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {booking.marketCity ? `${booking.marketCity}, ${booking.marketState}` : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={`font-bold ${getScoreColor(booking.qaScores?.percentage || 0)}`}>
                              {booking.qaScores?.percentage}%
                            </span>
                            <span className="text-xs text-muted-foreground ml-1">
                              ({booking.qaScores?.total}/{booking.qaScores?.maxTotal})
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Agent Coaching Review Modal */}
      <Dialog open={!!selectedAgentForModal} onOpenChange={() => setSelectedAgentForModal(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-pink-500" />
              {selectedAgentName}'s QA Coaching
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh] pr-4">
            {selectedAgentCoachingBookings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No coaching audio available for this agent yet.
              </div>
            ) : (
              <div className="space-y-4">
                {selectedAgentCoachingBookings
                  .sort((a, b) => new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime())
                  .map((booking) => (
                    <div key={booking.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{booking.memberName || 'Unknown Member'}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(booking.bookingDate, 'MMM d, yyyy')}
                            {booking.marketCity && ` • ${booking.marketCity}, ${booking.marketState}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {booking.qaScores && (
                            <Badge className={`${getScoreColor(booking.qaScores.percentage)}`}>
                              {booking.qaScores.percentage}%
                            </Badge>
                          )}
                          {booking.qaCoachingAudioListenedAt && (
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Listened
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <QACoachingAudioPlayer
                        bookingId={booking.bookingId}
                        audioUrl={booking.qaCoachingAudioUrl}
                        listenedAt={booking.qaCoachingAudioListenedAt}
                        qaScore={booking.qaScores?.percentage}
                        variant="button"
                        agentUserId={booking.agentUserId}
                      />
                    </div>
                  ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
