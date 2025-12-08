import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { usePageTracking } from '@/hooks/usePageTracking';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAgents } from '@/contexts/AgentsContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCoachingData, CoachingBookingWithAudio } from '@/hooks/useCoachingData';
import { useQACoachingData, QACoachingBooking } from '@/hooks/useQACoachingData';
import { DateRangeFilter, DateFilterValue, CustomDateRange } from '@/components/dashboard/DateRangeFilter';
import { getDateRangeFromFilter, DateRangeFilter as DateRangeFilterType, CustomDateRange as CalcCustomDateRange } from '@/utils/dashboardCalculations';
import { supabase } from '@/integrations/supabase/client';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, Cell
} from 'recharts';
import { 
  Headphones, 
  CheckCircle2, 
  Clock,
  Loader2,
  Trophy,
  Users,
  Mic,
  ClipboardCheck,
} from 'lucide-react';
import { startOfDay } from 'date-fns';
import { useEffect } from 'react';

interface Site {
  id: string;
  name: string;
}

interface AgentEngagementStats {
  agentId: string;
  agentName: string;
  siteName: string;
  siteId: string;
  jeffTotal: number;
  jeffListened: number;
  jeffPercentage: number;
  kattyTotal: number;
  kattyListened: number;
  kattyPercentage: number;
  combinedTotal: number;
  combinedListened: number;
  combinedPercentage: number;
}

export default function CoachingEngagement() {
  usePageTracking('view_coaching_engagement');
  
  const { coachingBookingsWithAudio, isLoading: jeffLoading } = useCoachingData({ includeAudio: true });
  const { qaCoachingBookings, isLoading: kattyLoading } = useQACoachingData();
  const { agents } = useAgents();
  const { user } = useAuth();
  
  const [dateRange, setDateRange] = useState<DateRangeFilterType>('all');
  const [customDates, setCustomDates] = useState<CalcCustomDateRange | undefined>(undefined);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('all');
  const [sites, setSites] = useState<Site[]>([]);

  // Fetch sites
  useEffect(() => {
    const fetchSites = async () => {
      const { data } = await supabase.from('sites').select('id, name').order('name');
      if (data) setSites(data);
    };
    fetchSites();
  }, []);

  // For supervisors, lock to their site
  useEffect(() => {
    if (user?.role === 'supervisor' && user?.siteId) {
      setSelectedSiteId(user.siteId);
    }
  }, [user]);

  const handleRangeChange = (range: DateFilterValue, dates?: CustomDateRange) => {
    setDateRange(range as DateRangeFilterType);
    setCustomDates(range === 'custom' && dates ? dates : undefined);
  };

  // Filter by site
  const filteredAgents = useMemo(() => {
    if (selectedSiteId === 'all') return agents;
    return agents.filter(a => a.siteId === selectedSiteId);
  }, [agents, selectedSiteId]);

  // Filter Jeff's coaching by date and agents
  const filteredJeffBookings = useMemo(() => {
    const agentIds = new Set(filteredAgents.map(a => a.id));
    let filtered = coachingBookingsWithAudio.filter(b => agentIds.has(b.agentId) && b.coachingAudioUrl);
    
    if (dateRange !== 'all') {
      const { start, end } = getDateRangeFromFilter(dateRange, customDates);
      filtered = filtered.filter(b => {
        const bookingDate = b.bookingDate instanceof Date 
          ? startOfDay(b.bookingDate)
          : startOfDay(new Date(b.bookingDate + 'T00:00:00'));
        return bookingDate >= startOfDay(start) && bookingDate <= startOfDay(end);
      });
    }
    
    return filtered;
  }, [coachingBookingsWithAudio, filteredAgents, dateRange, customDates]);

  // Filter Katty's QA coaching by date and agents
  const filteredKattyBookings = useMemo(() => {
    const agentIds = new Set(filteredAgents.map(a => a.id));
    let filtered = qaCoachingBookings.filter(b => agentIds.has(b.agentId) && b.qaCoachingAudioUrl);
    
    if (dateRange !== 'all') {
      const { start, end } = getDateRangeFromFilter(dateRange, customDates);
      filtered = filtered.filter(b => {
        const bookingDate = b.bookingDate instanceof Date 
          ? startOfDay(b.bookingDate)
          : startOfDay(new Date(b.bookingDate + 'T00:00:00'));
        return bookingDate >= startOfDay(start) && bookingDate <= startOfDay(end);
      });
    }
    
    return filtered;
  }, [qaCoachingBookings, filteredAgents, dateRange, customDates]);

  // Calculate engagement stats per agent
  const agentEngagementStats: AgentEngagementStats[] = useMemo(() => {
    return filteredAgents.map(agent => {
      const site = sites.find(s => s.id === agent.siteId);
      
      // Jeff's stats for this agent
      const jeffBookings = filteredJeffBookings.filter(b => b.agentId === agent.id);
      const jeffListened = jeffBookings.filter(b => b.coachingAudioListenedAt).length;
      const jeffTotal = jeffBookings.length;
      const jeffPercentage = jeffTotal > 0 ? Math.round((jeffListened / jeffTotal) * 100) : 0;
      
      // Katty's stats for this agent
      const kattyBookings = filteredKattyBookings.filter(b => b.agentId === agent.id);
      const kattyListened = kattyBookings.filter(b => b.qaCoachingAudioListenedAt).length;
      const kattyTotal = kattyBookings.length;
      const kattyPercentage = kattyTotal > 0 ? Math.round((kattyListened / kattyTotal) * 100) : 0;
      
      // Combined
      const combinedTotal = jeffTotal + kattyTotal;
      const combinedListened = jeffListened + kattyListened;
      const combinedPercentage = combinedTotal > 0 ? Math.round((combinedListened / combinedTotal) * 100) : 0;
      
      return {
        agentId: agent.id,
        agentName: agent.name,
        siteName: site?.name || 'Unknown',
        siteId: agent.siteId,
        jeffTotal,
        jeffListened,
        jeffPercentage,
        kattyTotal,
        kattyListened,
        kattyPercentage,
        combinedTotal,
        combinedListened,
        combinedPercentage,
      };
    }).filter(s => s.combinedTotal > 0).sort((a, b) => b.combinedPercentage - a.combinedPercentage);
  }, [filteredAgents, filteredJeffBookings, filteredKattyBookings, sites]);

  // Summary stats
  const summaryStats = useMemo(() => {
    const jeffTotal = filteredJeffBookings.length;
    const jeffListened = filteredJeffBookings.filter(b => b.coachingAudioListenedAt).length;
    const jeffPercentage = jeffTotal > 0 ? Math.round((jeffListened / jeffTotal) * 100) : 0;
    
    const kattyTotal = filteredKattyBookings.length;
    const kattyListened = filteredKattyBookings.filter(b => b.qaCoachingAudioListenedAt).length;
    const kattyPercentage = kattyTotal > 0 ? Math.round((kattyListened / kattyTotal) * 100) : 0;
    
    const combinedTotal = jeffTotal + kattyTotal;
    const combinedListened = jeffListened + kattyListened;
    const combinedPercentage = combinedTotal > 0 ? Math.round((combinedListened / combinedTotal) * 100) : 0;
    
    const topAgent = agentEngagementStats.length > 0 ? agentEngagementStats[0] : null;
    
    return {
      jeff: { total: jeffTotal, listened: jeffListened, percentage: jeffPercentage },
      katty: { total: kattyTotal, listened: kattyListened, percentage: kattyPercentage },
      combined: { total: combinedTotal, listened: combinedListened, percentage: combinedPercentage },
      topAgent,
    };
  }, [filteredJeffBookings, filteredKattyBookings, agentEngagementStats]);

  // Chart data for comparison
  const chartData = useMemo(() => {
    return agentEngagementStats.slice(0, 10).map(agent => ({
      name: agent.agentName.split(' ')[0],
      jeff: agent.jeffPercentage,
      katty: agent.kattyPercentage,
    }));
  }, [agentEngagementStats]);

  const getPercentageBadgeVariant = (percentage: number) => {
    if (percentage >= 80) return 'default';
    if (percentage >= 50) return 'secondary';
    return 'destructive';
  };

  const isLoading = jeffLoading || kattyLoading;
  const isSupervisor = user?.role === 'supervisor';

  return (
    <DashboardLayout title="Coaching Engagement" subtitle="Track how agents engage with AI coaching audio">
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <DateRangeFilter 
            onRangeChange={handleRangeChange} 
            defaultValue="all"
            includeAllTime={true}
            includeCustom={true}
          />
          <div className="flex items-center gap-3">
            <Select 
              value={selectedSiteId} 
              onValueChange={setSelectedSiteId}
              disabled={isSupervisor}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Sites" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sites</SelectItem>
                {sites.map(site => (
                  <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Loading Engagement Data...</h3>
            </CardContent>
          </Card>
        ) : summaryStats.combined.total === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Headphones className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No Coaching Audio Yet</h3>
              <p className="text-muted-foreground">
                Generate coaching audio from transcribed calls to track engagement.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Jeff's Coaching */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Mic className="w-5 h-5 text-blue-500" />
                      <span className="text-sm font-medium text-muted-foreground">Jeff's Coaching</span>
                    </div>
                    <Badge variant={getPercentageBadgeVariant(summaryStats.jeff.percentage)}>
                      {summaryStats.jeff.percentage}%
                    </Badge>
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {summaryStats.jeff.listened}/{summaryStats.jeff.total}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">coaching audios listened</p>
                </CardContent>
              </Card>

              {/* Katty's QA Coaching */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <ClipboardCheck className="w-5 h-5 text-purple-500" />
                      <span className="text-sm font-medium text-muted-foreground">Katty's QA</span>
                    </div>
                    <Badge variant={getPercentageBadgeVariant(summaryStats.katty.percentage)}>
                      {summaryStats.katty.percentage}%
                    </Badge>
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {summaryStats.katty.listened}/{summaryStats.katty.total}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">QA audios listened</p>
                </CardContent>
              </Card>

              {/* Combined Engagement */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Headphones className="w-5 h-5 text-primary" />
                      <span className="text-sm font-medium text-muted-foreground">Combined</span>
                    </div>
                    <Badge variant={getPercentageBadgeVariant(summaryStats.combined.percentage)}>
                      {summaryStats.combined.percentage}%
                    </Badge>
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {summaryStats.combined.listened}/{summaryStats.combined.total}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">total audios listened</p>
                </CardContent>
              </Card>

              {/* Top Engaged Agent */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-amber-500" />
                      <span className="text-sm font-medium text-muted-foreground">Top Engaged</span>
                    </div>
                    {summaryStats.topAgent && (
                      <Badge variant="default">{summaryStats.topAgent.combinedPercentage}%</Badge>
                    )}
                  </div>
                  <p className="text-xl font-bold text-foreground truncate">
                    {summaryStats.topAgent?.agentName || 'N/A'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {summaryStats.topAgent 
                      ? `${summaryStats.topAgent.combinedListened}/${summaryStats.topAgent.combinedTotal} audios`
                      : 'No data yet'
                    }
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Engagement Comparison Chart */}
            {chartData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    Engagement by Agent (Jeff vs Katty)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={true} vertical={false} />
                        <XAxis 
                          type="number" 
                          domain={[0, 100]}
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                          axisLine={{ stroke: 'hsl(var(--border))' }}
                          tickLine={false}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <YAxis 
                          type="category" 
                          dataKey="name" 
                          width={80}
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
                          formatter={(value: number, name: string) => [`${value}%`, name === 'jeff' ? "Jeff's Coaching" : "Katty's QA"]}
                        />
                        <Legend formatter={(value) => value === 'jeff' ? "Jeff's Coaching" : "Katty's QA"} />
                        <Bar dataKey="jeff" name="jeff" fill="hsl(210, 100%, 50%)" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="katty" name="katty" fill="hsl(270, 70%, 60%)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Agent Breakdown Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Agent Engagement Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Agent</TableHead>
                        <TableHead>Site</TableHead>
                        <TableHead className="text-center">Jeff's Coaching</TableHead>
                        <TableHead className="text-center">Katty's QA</TableHead>
                        <TableHead className="text-center">Combined</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agentEngagementStats.map((agent, index) => (
                        <TableRow key={agent.agentId}>
                          <TableCell className="font-medium text-muted-foreground">
                            {index + 1}
                          </TableCell>
                          <TableCell className="font-medium">{agent.agentName}</TableCell>
                          <TableCell className="text-muted-foreground">{agent.siteName}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-sm text-muted-foreground">
                                {agent.jeffListened}/{agent.jeffTotal}
                              </span>
                              {agent.jeffTotal > 0 && (
                                <Badge variant={getPercentageBadgeVariant(agent.jeffPercentage)} className="min-w-[3rem]">
                                  {agent.jeffPercentage}%
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-sm text-muted-foreground">
                                {agent.kattyListened}/{agent.kattyTotal}
                              </span>
                              {agent.kattyTotal > 0 && (
                                <Badge variant={getPercentageBadgeVariant(agent.kattyPercentage)} className="min-w-[3rem]">
                                  {agent.kattyPercentage}%
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-sm text-muted-foreground">
                                {agent.combinedListened}/{agent.combinedTotal}
                              </span>
                              <Badge variant={getPercentageBadgeVariant(agent.combinedPercentage)} className="min-w-[3rem]">
                                {agent.combinedPercentage}%
                              </Badge>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {agentEngagementStats.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No agents with coaching audio in selected filters
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
