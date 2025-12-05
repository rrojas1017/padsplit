import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useBookings } from '@/contexts/BookingsContext';
import { useAgents } from '@/contexts/AgentsContext';
import { useAuth } from '@/contexts/AuthContext';
import { 
  calculateTeamAverageScores, 
  calculateRatingDistribution, 
  getCommonStrengths, 
  getCommonImprovements,
  getAgentCoachingStats,
  getAgentDetailedFeedback
} from '@/utils/coachingCalculations';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { 
  MessageSquare, 
  BookOpen, 
  Shield, 
  Target, 
  TrendingUp, 
  TrendingDown,
  Star,
  User,
  Phone
} from 'lucide-react';
import { format } from 'date-fns';

const RATING_COLORS = {
  excellent: 'hsl(var(--chart-1))',
  good: 'hsl(var(--chart-2))',
  needsImprovement: 'hsl(var(--chart-3))',
  poor: 'hsl(var(--chart-4))',
};

export default function CoachingHub() {
  const { bookings } = useBookings();
  const { agents } = useAgents();
  const { user } = useAuth();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  // Filter agents by site for supervisors
  const filteredAgents = useMemo(() => {
    if (user?.role === 'supervisor' && user?.siteId) {
      return agents.filter(a => a.siteId === user.siteId);
    }
    return agents;
  }, [agents, user]);

  // Filter bookings by filtered agents
  const filteredBookings = useMemo(() => {
    const agentIds = new Set(filteredAgents.map(a => a.id));
    return bookings.filter(b => agentIds.has(b.agentId));
  }, [bookings, filteredAgents]);

  const teamScores = useMemo(() => calculateTeamAverageScores(filteredBookings), [filteredBookings]);
  const ratingDistribution = useMemo(() => calculateRatingDistribution(filteredBookings), [filteredBookings]);
  const commonStrengths = useMemo(() => getCommonStrengths(filteredBookings), [filteredBookings]);
  const commonImprovements = useMemo(() => getCommonImprovements(filteredBookings), [filteredBookings]);
  const agentStats = useMemo(() => getAgentCoachingStats(filteredBookings, filteredAgents), [filteredBookings, filteredAgents]);

  const selectedAgentStats = useMemo(() => {
    if (!selectedAgentId) return null;
    return agentStats.find(s => s.agentId === selectedAgentId);
  }, [selectedAgentId, agentStats]);

  const selectedAgentFeedback = useMemo(() => {
    if (!selectedAgentId) return [];
    return getAgentDetailedFeedback(filteredBookings, selectedAgentId);
  }, [selectedAgentId, filteredBookings]);

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

        {teamScores.totalCalls === 0 ? (
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
                        <Tooltip />
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
                        <li key={index} className="flex items-center justify-between text-sm">
                          <span className="text-foreground capitalize truncate flex-1">{item.strength}</span>
                          <Badge variant="secondary" className="ml-2">{item.count}</Badge>
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
                        <li key={index} className="flex items-center justify-between text-sm">
                          <span className="text-foreground capitalize truncate flex-1">{item.improvement}</span>
                          <Badge variant="outline" className="ml-2">{item.count}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
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
                          <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agentStats.map((agent) => (
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
                            <td className="text-right py-3 px-2">
                              <button
                                onClick={() => setSelectedAgentId(agent.agentId)}
                                className="text-primary hover:underline text-sm font-medium"
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        ))}
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

                {/* Call History */}
                <div>
                  <h4 className="font-medium text-foreground mb-2">Call History ({selectedAgentFeedback.length} calls)</h4>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {selectedAgentFeedback.map(({ booking, feedback }) => (
                      <div key={booking.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                        <div>
                          <p className="text-sm font-medium text-foreground">{booking.memberName}</p>
                          <p className="text-xs text-muted-foreground">{format(booking.bookingDate, 'MMM d, yyyy')}</p>
                        </div>
                        <Badge variant={getRatingBadgeVariant(feedback.overallRating)}>
                          {feedback.overallRating?.replace('_', ' ')}
                        </Badge>
                      </div>
                    ))}
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
