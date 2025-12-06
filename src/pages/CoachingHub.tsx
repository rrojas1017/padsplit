import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { usePageTracking } from '@/hooks/usePageTracking';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAgents } from '@/contexts/AgentsContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCoachingData } from '@/hooks/useCoachingData';
import { DateRangeFilter, DateFilterValue } from '@/components/dashboard/DateRangeFilter';
import { getDateRangeFromFilter, DateRangeFilter as DateRangeFilterType } from '@/utils/dashboardCalculations';
import { 
  calculateTeamAverageScoresFromCoaching, 
  calculateRatingDistributionFromCoaching, 
  getCommonStrengthsFromCoaching, 
  getCommonImprovementsFromCoaching,
  getAgentCoachingStatsFromCoaching,
  getAgentDetailedFeedbackFromCoaching,
  calculateScoresTrendFromCoaching,
  calculateAgentScoresTrendFromCoaching,
  calculateTeamListeningStats,
  CoachingBooking,
} from '@/utils/coachingCalculations';
import { CoachingAudioPlayer } from '@/components/coaching/CoachingAudioPlayer';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  MessageSquare, 
  BookOpen, 
  Shield, 
  Target, 
  TrendingUp, 
  TrendingDown,
  Star,
  User,
  Phone,
  Loader2,
  Headphones,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { format, startOfDay } from 'date-fns';

const RATING_COLORS = {
  excellent: 'hsl(var(--chart-1))',
  good: 'hsl(var(--chart-2))',
  needsImprovement: 'hsl(var(--chart-3))',
  poor: 'hsl(var(--chart-4))',
};

export default function CoachingHub() {
  usePageTracking('view_coaching_hub');
  const { coachingBookings, isLoading: coachingLoading } = useCoachingData();
  const { agents } = useAgents();
  const { user } = useAuth();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeFilterType>('all');

  // Filter agents by site for supervisors
  const filteredAgents = useMemo(() => {
    if (user?.role === 'supervisor' && user?.siteId) {
      return agents.filter(a => a.siteId === user.siteId);
    }
    return agents;
  }, [agents, user]);

  // Filter coaching bookings by filtered agents
  const filteredCoachingBookings = useMemo(() => {
    const agentIds = new Set(filteredAgents.map(a => a.id));
    return coachingBookings.filter(b => agentIds.has(b.agentId));
  }, [coachingBookings, filteredAgents]);

  // Apply date filtering
  const dateFilteredCoachingBookings = useMemo(() => {
    if (dateRange === 'all') return filteredCoachingBookings;
    
    const { start, end } = getDateRangeFromFilter(dateRange);
    return filteredCoachingBookings.filter(b => {
      const bookingDate = b.bookingDate instanceof Date 
        ? startOfDay(b.bookingDate)
        : startOfDay(new Date(b.bookingDate + 'T00:00:00'));
      return bookingDate >= startOfDay(start) && bookingDate <= startOfDay(end);
    });
  }, [filteredCoachingBookings, dateRange]);

  const teamScores = useMemo(() => calculateTeamAverageScoresFromCoaching(dateFilteredCoachingBookings), [dateFilteredCoachingBookings]);
  const ratingDistribution = useMemo(() => calculateRatingDistributionFromCoaching(dateFilteredCoachingBookings), [dateFilteredCoachingBookings]);
  const commonStrengths = useMemo(() => getCommonStrengthsFromCoaching(dateFilteredCoachingBookings), [dateFilteredCoachingBookings]);
  const commonImprovements = useMemo(() => getCommonImprovementsFromCoaching(dateFilteredCoachingBookings), [dateFilteredCoachingBookings]);
  const agentStats = useMemo(() => getAgentCoachingStatsFromCoaching(dateFilteredCoachingBookings, filteredAgents), [dateFilteredCoachingBookings, filteredAgents]);
  const listeningStats = useMemo(() => calculateTeamListeningStats(agentStats), [agentStats]);
  const scoreTrendData = useMemo(() => calculateScoresTrendFromCoaching(dateFilteredCoachingBookings), [dateFilteredCoachingBookings]);

  const selectedAgentStats = useMemo(() => {
    if (!selectedAgentId) return null;
    return agentStats.find(s => s.agentId === selectedAgentId);
  }, [selectedAgentId, agentStats]);

  const selectedAgentFeedback = useMemo(() => {
    if (!selectedAgentId) return [];
    return getAgentDetailedFeedbackFromCoaching(dateFilteredCoachingBookings, selectedAgentId);
  }, [selectedAgentId, dateFilteredCoachingBookings]);

  const selectedAgentTrendData = useMemo(() => {
    if (!selectedAgentId) return [];
    return calculateAgentScoresTrendFromCoaching(dateFilteredCoachingBookings, selectedAgentId);
  }, [selectedAgentId, dateFilteredCoachingBookings]);

  const pieData = [
    { name: 'Excellent', value: ratingDistribution.excellent, color: RATING_COLORS.excellent },
    { name: 'Good', value: ratingDistribution.good, color: RATING_COLORS.good },
    { name: 'Needs Improvement', value: ratingDistribution.needsImprovement, color: RATING_COLORS.needsImprovement },
    { name: 'Poor', value: ratingDistribution.poor, color: RATING_COLORS.poor },
  ].filter(d => d.value > 0);

  const scoreCards = [
    { label: 'Communication', value: teamScores.communication, icon: MessageSquare, color: 'text-blue-500' },
    { label: 'Product Knowledge', value: teamScores.productKnowledge, icon: BookOpen, color: 'text-green-500' },
    { label: 'Objection Handling', value: teamScores.objectionHandling, icon: Shield, color: 'text-amber-500' },
    { label: 'Closing Skills', value: teamScores.closingSkills, icon: Target, color: 'text-purple-500' },
  ];

  const getRatingBadgeVariant = (rating: string) => {
    switch (rating) {
      case 'excellent': return 'default';
      case 'good': return 'secondary';
      case 'needs_improvement': return 'outline';
      case 'poor': return 'destructive';
      default: return 'secondary';
    }
  };

  return (
    <DashboardLayout title="Coaching Hub" subtitle="AI-powered coaching insights for your team">
      <div className="space-y-6">

        {/* Header with Date Filter */}
        <div className="flex items-center justify-between">
          <DateRangeFilter 
            onRangeChange={(range) => setDateRange(range as DateRangeFilterType)} 
            defaultValue="all"
            includeAllTime={true}
          />
          <div className="text-sm text-muted-foreground">
            {teamScores.totalCalls} calls analyzed
          </div>
        </div>

        {coachingLoading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Loading Coaching Data...</h3>
            </CardContent>
          </Card>
        ) : teamScores.totalCalls === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Phone className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No Coaching Data Yet</h3>
              <p className="text-muted-foreground">
                Transcribe call recordings from the Reports page to generate coaching insights.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Team Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {scoreCards.map((card) => (
                <Card key={card.label}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-2">
                      <card.icon className={`w-5 h-5 ${card.color}`} />
                      <span className="text-2xl font-bold text-foreground">{card.value}/10</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{card.label}</p>
                    <Progress value={card.value * 10} className="mt-2 h-2" />
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Team Performance Trend Chart */}
            {scoreTrendData.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Team Performance Trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={scoreTrendData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis 
                          dataKey="dateLabel" 
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                          axisLine={{ stroke: 'hsl(var(--border))' }}
                          tickLine={false}
                        />
                        <YAxis 
                          domain={[0, 10]} 
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                          axisLine={{ stroke: 'hsl(var(--border))' }}
                          tickLine={false}
                        />
                        <RechartsTooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                          labelStyle={{ color: 'hsl(var(--foreground))' }}
                          formatter={(value: number, name: string) => [value.toFixed(1), name]}
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="communication" 
                          name="Communication" 
                          stroke="hsl(210, 100%, 50%)" 
                          strokeWidth={2}
                          dot={{ fill: 'hsl(210, 100%, 50%)', strokeWidth: 0, r: 3 }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="productKnowledge" 
                          name="Product Knowledge" 
                          stroke="hsl(142, 76%, 36%)" 
                          strokeWidth={2}
                          dot={{ fill: 'hsl(142, 76%, 36%)', strokeWidth: 0, r: 3 }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="objectionHandling" 
                          name="Objection Handling" 
                          stroke="hsl(45, 93%, 47%)" 
                          strokeWidth={2}
                          dot={{ fill: 'hsl(45, 93%, 47%)', strokeWidth: 0, r: 3 }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="closingSkills" 
                          name="Closing Skills" 
                          stroke="hsl(262, 83%, 58%)" 
                          strokeWidth={2}
                          dot={{ fill: 'hsl(262, 83%, 58%)', strokeWidth: 0, r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Rating Distribution & Common Patterns */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Rating Distribution Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Rating Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-center text-sm text-muted-foreground mt-2">
                    {teamScores.totalCalls} calls analyzed
                  </p>
                </CardContent>
              </Card>

              {/* Common Strengths */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                    Top Strengths
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {commonStrengths.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No strengths identified yet</p>
                  ) : (
                    <ul className="space-y-2">
                      {commonStrengths.map((item, index) => (
                        <li key={index} className="flex items-start justify-between text-sm gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-foreground capitalize line-clamp-2 flex-1 break-words cursor-help">
                                {item.strength}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <p>{item.strength}</p>
                            </TooltipContent>
                          </Tooltip>
                          <Badge variant="secondary" className="shrink-0">{item.count}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              {/* Common Improvements */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-amber-500" />
                    Areas for Improvement
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {commonImprovements.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No improvements identified yet</p>
                  ) : (
                    <ul className="space-y-2">
                      {commonImprovements.map((item, index) => (
                        <li key={index} className="flex items-start justify-between text-sm gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-foreground capitalize line-clamp-2 flex-1 break-words cursor-help">
                                {item.improvement}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <p>{item.improvement}</p>
                            </TooltipContent>
                          </Tooltip>
                          <Badge variant="outline" className="shrink-0">{item.count}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Team Listening Engagement Card */}
            {listeningStats.totalCoachingAudios > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Headphones className="w-5 h-5 text-primary" />
                    Coaching Engagement
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 rounded-lg bg-muted">
                      <p className="text-2xl font-bold text-foreground">{listeningStats.overallPercentage}%</p>
                      <p className="text-xs text-muted-foreground">Overall Listened</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted">
                      <p className="text-2xl font-bold text-foreground">{listeningStats.totalListened}/{listeningStats.totalCoachingAudios}</p>
                      <p className="text-xs text-muted-foreground">Audios Listened</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted">
                      <p className="text-2xl font-bold text-amber-500">{listeningStats.unlistenedCount}</p>
                      <p className="text-xs text-muted-foreground">Pending Listens</p>
                    </div>
                    {listeningStats.mostEngagedAgent && (
                      <div className="text-center p-3 rounded-lg bg-muted">
                        <p className="text-lg font-bold text-foreground">{listeningStats.mostEngagedAgent.name}</p>
                        <p className="text-xs text-muted-foreground">Most Engaged ({listeningStats.mostEngagedAgent.percentage}%)</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Rolling Info Banner */}
            <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 border border-primary/20 mb-4 w-full h-12">
              <div className="absolute flex animate-marquee hover-pause whitespace-nowrap py-3 px-4">
                {/* Content repeated twice for seamless loop */}
                <div className="flex items-center gap-4 mx-8">
                  <Headphones className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-sm text-foreground font-medium">
                    💡 Tip: Click "View Details" on any agent → Scroll to "Call History" to listen to coaching audio for each call
                  </span>
                  <span className="text-accent">•</span>
                  <span className="text-sm text-muted-foreground">
                    Agents access their own coaching via "My Performance" page
                  </span>
                  <span className="text-accent">•</span>
                </div>
                {/* Duplicate for seamless loop */}
                <div className="flex items-center gap-4 mx-8">
                  <Headphones className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-sm text-foreground font-medium">
                    💡 Tip: Click "View Details" on any agent → Scroll to "Call History" to listen to coaching audio for each call
                  </span>
                  <span className="text-accent">•</span>
                  <span className="text-sm text-muted-foreground">
                    Agents access their own coaching via "My Performance" page
                  </span>
                  <span className="text-accent">•</span>
                </div>
              </div>
            </div>

            {/* Agent Performance Table */}
            <Card>
              <CardHeader>
                <CardTitle>Agent Performance</CardTitle>
              </CardHeader>
              <CardContent>
                {agentStats.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No agent coaching data available</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Agent</th>
                          <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground">Calls</th>
                          <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground">Overall</th>
                          <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground hidden md:table-cell">Comm</th>
                          <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground hidden md:table-cell">Product</th>
                          <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground hidden lg:table-cell">Objection</th>
                          <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground hidden lg:table-cell">Closing</th>
                          <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground">Listening</th>
                          <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agentStats.map((agent) => {
                          const listeningBadgeClass = agent.totalCoachingAudios === 0 
                            ? 'bg-muted text-muted-foreground'
                            : agent.listenedPercentage >= 80 
                              ? 'bg-green-500/20 text-green-600' 
                              : agent.listenedPercentage >= 50 
                                ? 'bg-amber-500/20 text-amber-600' 
                                : 'bg-red-500/20 text-red-600';
                          
                          return (
                            <tr key={agent.agentId} className="border-b border-border/50 hover:bg-muted/50">
                              <td className="py-3 px-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                    <User className="w-4 h-4 text-primary" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-foreground">{agent.agentName}</p>
                                    <p className="text-xs text-muted-foreground">{agent.siteName}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="text-center py-3 px-2">
                                <Badge variant="secondary">{agent.callCount}</Badge>
                              </td>
                              <td className="text-center py-3 px-2">
                                <div className="flex items-center justify-center gap-1">
                                  <Star className="w-4 h-4 text-amber-500" />
                                  <span className="font-medium text-foreground">{agent.averageScores.overall}</span>
                                </div>
                              </td>
                              <td className="text-center py-3 px-2 hidden md:table-cell text-foreground">{agent.averageScores.communication}</td>
                              <td className="text-center py-3 px-2 hidden md:table-cell text-foreground">{agent.averageScores.productKnowledge}</td>
                              <td className="text-center py-3 px-2 hidden lg:table-cell text-foreground">{agent.averageScores.objectionHandling}</td>
                              <td className="text-center py-3 px-2 hidden lg:table-cell text-foreground">{agent.averageScores.closingSkills}</td>
                              <td className="text-center py-3 px-2">
                                {agent.totalCoachingAudios > 0 ? (
                                  <Badge className={listeningBadgeClass}>
                                    {agent.listenedCount}/{agent.totalCoachingAudios} ({agent.listenedPercentage}%)
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">No audio</span>
                                )}
                              </td>
                              <td className="text-right py-3 px-2">
                                <button
                                  onClick={() => setSelectedAgentId(agent.agentId)}
                                  className="text-primary hover:underline text-sm font-medium"
                                >
                                  View Details
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Agent Detail Modal */}
        <Dialog open={!!selectedAgentId} onOpenChange={(open) => !open && setSelectedAgentId(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                {selectedAgentStats?.agentName} - Coaching Details
              </DialogTitle>
            </DialogHeader>

            {selectedAgentStats && (
              <div className="space-y-6">
                {/* Score Overview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="text-center p-3 rounded-lg bg-muted">
                    <p className="text-2xl font-bold text-foreground">{selectedAgentStats.averageScores.communication}</p>
                    <p className="text-xs text-muted-foreground">Communication</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted">
                    <p className="text-2xl font-bold text-foreground">{selectedAgentStats.averageScores.productKnowledge}</p>
                    <p className="text-xs text-muted-foreground">Product Knowledge</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted">
                    <p className="text-2xl font-bold text-foreground">{selectedAgentStats.averageScores.objectionHandling}</p>
                    <p className="text-xs text-muted-foreground">Objection Handling</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted">
                    <p className="text-2xl font-bold text-foreground">{selectedAgentStats.averageScores.closingSkills}</p>
                    <p className="text-xs text-muted-foreground">Closing Skills</p>
                  </div>
                </div>

                {/* Agent Performance Trend */}
                {selectedAgentTrendData.length > 1 && (
                  <div>
                    <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" /> Performance Trend
                    </h4>
                    <div className="h-[200px] bg-muted/30 rounded-lg p-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={selectedAgentTrendData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                          <XAxis 
                            dataKey="dateLabel" 
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                            axisLine={{ stroke: 'hsl(var(--border))' }}
                            tickLine={false}
                          />
                          <YAxis 
                            domain={[0, 10]} 
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                            axisLine={{ stroke: 'hsl(var(--border))' }}
                            tickLine={false}
                          />
                          <RechartsTooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))', 
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                              fontSize: '12px'
                            }}
                            labelStyle={{ color: 'hsl(var(--foreground))' }}
                            formatter={(value: number, name: string) => [value.toFixed(1), name]}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="communication" 
                            name="Communication" 
                            stroke="hsl(210, 100%, 50%)" 
                            strokeWidth={2}
                            dot={{ fill: 'hsl(210, 100%, 50%)', strokeWidth: 0, r: 2 }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="productKnowledge" 
                            name="Product Knowledge" 
                            stroke="hsl(142, 76%, 36%)" 
                            strokeWidth={2}
                            dot={{ fill: 'hsl(142, 76%, 36%)', strokeWidth: 0, r: 2 }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="objectionHandling" 
                            name="Objection Handling" 
                            stroke="hsl(45, 93%, 47%)" 
                            strokeWidth={2}
                            dot={{ fill: 'hsl(45, 93%, 47%)', strokeWidth: 0, r: 2 }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="closingSkills" 
                            name="Closing Skills" 
                            stroke="hsl(262, 83%, 58%)" 
                            strokeWidth={2}
                            dot={{ fill: 'hsl(262, 83%, 58%)', strokeWidth: 0, r: 2 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Strengths & Improvements */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-500" /> Strengths
                    </h4>
                    {selectedAgentStats.recentStrengths.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No strengths recorded</p>
                    ) : (
                      <ul className="space-y-1">
                        {selectedAgentStats.recentStrengths.map((s, i) => (
                          <li key={i} className="text-sm text-foreground">• {s}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-amber-500" /> Areas to Improve
                    </h4>
                    {selectedAgentStats.recentImprovements.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No improvements recorded</p>
                    ) : (
                      <ul className="space-y-1">
                        {selectedAgentStats.recentImprovements.map((s, i) => (
                          <li key={i} className="text-sm text-foreground">• {s}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Coaching Tips */}
                {selectedAgentStats.recentTips.length > 0 && (
                  <div>
                    <h4 className="font-medium text-foreground mb-2">Recent Coaching Tips</h4>
                    <ul className="space-y-2">
                      {selectedAgentStats.recentTips.map((tip, i) => (
                        <li key={i} className="text-sm text-muted-foreground bg-muted p-2 rounded">
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Listening Stats Summary */}
                {selectedAgentStats.totalCoachingAudios > 0 && (
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Headphones className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium text-foreground">Listening Progress</span>
                      </div>
                      <Badge className={
                        selectedAgentStats.listenedPercentage >= 80 
                          ? 'bg-green-500/20 text-green-600' 
                          : selectedAgentStats.listenedPercentage >= 50 
                            ? 'bg-amber-500/20 text-amber-600' 
                            : 'bg-red-500/20 text-red-600'
                      }>
                        {selectedAgentStats.listenedCount}/{selectedAgentStats.totalCoachingAudios} ({selectedAgentStats.listenedPercentage}%)
                      </Badge>
                    </div>
                  </div>
                )}

                {/* Call History with Audio Players */}
                <div>
                  <h4 className="font-medium text-foreground mb-2">Call History ({selectedAgentFeedback.length} calls)</h4>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {selectedAgentFeedback.map(({ booking, feedback }) => {
                      const coachingBooking = dateFilteredCoachingBookings.find(b => b.id === booking.id);
                      const hasAudio = !!coachingBooking?.coachingAudioUrl;
                      const hasListened = !!coachingBooking?.coachingAudioListenedAt;
                      
                      return (
                        <div key={booking.id} className="p-3 rounded-lg bg-muted/50 border border-border/50">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="text-sm font-medium text-foreground">{booking.memberName}</p>
                              <p className="text-xs text-muted-foreground">{format(booking.bookingDate, 'MMM d, yyyy')}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={getRatingBadgeVariant(feedback.overallRating)}>
                                {feedback.overallRating?.replace('_', ' ')}
                              </Badge>
                              {hasAudio && (
                                hasListened ? (
                                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    Listened
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                                    <Clock className="w-3 h-3 mr-1" />
                                    Pending
                                  </Badge>
                                )
                              )}
                            </div>
                          </div>
                          {/* Audio Player */}
                          {coachingBooking && (
                            <CoachingAudioPlayer
                              bookingId={booking.id}
                              audioUrl={coachingBooking.coachingAudioUrl}
                              variant="inline"
                              listenedAt={coachingBooking.coachingAudioListenedAt}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
