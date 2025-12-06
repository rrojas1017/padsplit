import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { usePageTracking } from '@/hooks/usePageTracking';
import { useAuth } from '@/contexts/AuthContext';
import { useAgents } from '@/contexts/AgentsContext';
import { useQAData, calculateQAStats, QABooking } from '@/hooks/useQAData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardCheck, TrendingUp, TrendingDown, Calendar, Target, Award, BarChart3 } from 'lucide-react';
import { useState, useMemo } from 'react';
import { format, isWithinInterval, startOfDay, endOfDay, subDays, startOfWeek, startOfMonth } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

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

  const getScoreColor = (percentage: number) => {
    if (percentage >= 85) return 'text-success';
    if (percentage >= 70) return 'text-accent';
    return 'text-destructive';
  };

  const getScoreBadge = (percentage: number) => {
    if (percentage >= 90) return { label: 'Excellent', variant: 'default' as const };
    if (percentage >= 80) return { label: 'Good', variant: 'secondary' as const };
    if (percentage >= 70) return { label: 'Average', variant: 'outline' as const };
    return { label: 'Needs Work', variant: 'destructive' as const };
  };

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
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardCheck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No agent profile found for your account.</p>
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
      <div className="space-y-6">
        {/* Period Selector */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
              <SelectTrigger className="w-[180px]">
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
          <Badge variant="outline" className="gap-1">
            <Target className="w-3 h-3" />
            {stats.totalCalls} Scored Calls
          </Badge>
        </div>

        {/* Main Score Card */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="py-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-center md:text-left">
                <p className="text-sm text-muted-foreground mb-1">Your QA Score</p>
                <div className="flex items-baseline gap-2">
                  <span className={`text-5xl font-bold ${getScoreColor(stats.avgPercentage)}`}>
                    {stats.avgPercentage.toFixed(1)}%
                  </span>
                  <span className="text-muted-foreground text-lg">
                    ({stats.avgTotal.toFixed(1)}/{stats.maxTotal} pts)
                  </span>
                </div>
                {stats.totalCalls > 0 && (
                  <Badge {...getScoreBadge(stats.avgPercentage)} className="mt-3">
                    {getScoreBadge(stats.avgPercentage).label}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4">
                <Award className={`w-16 h-16 ${getScoreColor(stats.avgPercentage)}`} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        {categoryData.length > 0 && stats.totalCalls > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="w-5 h-5 text-accent" />
                Score by Category
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      width={100}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload?.[0]) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-popover border border-border p-3 rounded-lg shadow-lg">
                              <p className="font-medium text-sm">{data.fullName}</p>
                              <p className="text-accent">{data.score}/{data.max} pts ({data.percentage}%)</p>
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
            </CardContent>
          </Card>
        )}

        {/* Trend Chart */}
        {trendData.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="w-5 h-5 text-accent" />
                Score Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload?.[0]) {
                          return (
                            <div className="bg-popover border border-border p-2 rounded-lg shadow-lg">
                              <p className="font-medium">{payload[0].payload.date}</p>
                              <p className="text-accent">{payload[0].value}%</p>
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

        {/* Recent Calls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardCheck className="w-5 h-5 text-accent" />
              Recent QA Scores
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredBookings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ClipboardCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No QA scores available for this period.</p>
                <p className="text-sm mt-1">Scores are generated after call transcription.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {filteredBookings
                  .sort((a, b) => new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime())
                  .map(booking => (
                    <div 
                      key={booking.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div>
                        <p className="font-medium">{booking.memberName}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(booking.bookingDate + 'T00:00:00'), 'MMM d, yyyy')}
                          {booking.marketCity && ` • ${booking.marketCity}, ${booking.marketState}`}
                        </p>
                      </div>
                      <div className="text-right">
                        {booking.qaScores ? (
                          <>
                            <span className={`text-lg font-bold ${getScoreColor(booking.qaScores.percentage)}`}>
                              {booking.qaScores.percentage}%
                            </span>
                            <p className="text-xs text-muted-foreground">
                              {booking.qaScores.total}/{booking.qaScores.maxTotal} pts
                            </p>
                          </>
                        ) : (
                          <Badge variant="outline">Pending</Badge>
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
