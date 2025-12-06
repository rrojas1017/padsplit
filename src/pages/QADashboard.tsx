import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { usePageTracking } from '@/hooks/usePageTracking';
import { useAuth } from '@/contexts/AuthContext';
import { useAgents } from '@/contexts/AgentsContext';
import { useQAData, calculateQAStats, getAgentQARankings, QABooking } from '@/hooks/useQAData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  ClipboardCheck, TrendingUp, Calendar, Target, Award, BarChart3, 
  Users, Trophy, ChevronRight, Loader2, Zap 
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { format, isWithinInterval, startOfDay, endOfDay, startOfWeek, startOfMonth } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, Legend } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type DateRange = 'today' | 'week' | 'month' | 'all';

export default function QADashboard() {
  usePageTracking('view_qa_dashboard');
  const { user, hasRole } = useAuth();
  const { agents } = useAgents();
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [isBatchScoring, setIsBatchScoring] = useState(false);
  
  const { qaBookings, rubric, isLoading } = useQAData({ includeUnscored: true });

  // Filter by date range and agent
  const filteredBookings = useMemo(() => {
    let filtered = qaBookings;
    
    if (selectedAgent !== 'all') {
      filtered = filtered.filter(b => b.agentId === selectedAgent);
    }
    
    if (dateRange === 'all') return filtered;
    
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

    return filtered.filter(b => {
      const bookingDate = new Date(b.bookingDate + 'T00:00:00');
      return isWithinInterval(bookingDate, { start: startDate, end: endOfDay(now) });
    });
  }, [qaBookings, dateRange, selectedAgent]);

  const stats = calculateQAStats(filteredBookings, rubric);
  const rankings = getAgentQARankings(filteredBookings, agents);

  // Get unique agents with scores
  const agentsWithScores = useMemo(() => {
    const agentIds = new Set(qaBookings.map(b => b.agentId));
    return agents.filter(a => agentIds.has(a.id));
  }, [qaBookings, agents]);

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
            <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
              <SelectTrigger className="w-[140px]">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
            
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
                      <TableHead className="text-right">Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rankings.slice(0, 10).map((agent, index) => (
                      <TableRow key={agent.agentId}>
                        <TableCell>
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                        </TableCell>
                        <TableCell className="font-medium">{agent.agentName}</TableCell>
                        <TableCell className="text-center">{agent.callCount}</TableCell>
                        <TableCell className="text-right">
                          <span className={`font-bold ${getScoreColor(agent.avgPercentage)}`}>
                            {agent.avgPercentage}%
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
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
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload?.[0]) {
                          return (
                            <div className="bg-popover border border-border p-3 rounded-lg shadow-lg">
                              <p className="font-medium">{payload[0].payload.date}</p>
                              <p className="text-primary">{payload[0].value}% avg</p>
                              <p className="text-sm text-muted-foreground">{payload[0].payload.calls} calls</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="percentage" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))' }}
                    />
                  </LineChart>
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
    </DashboardLayout>
  );
}
