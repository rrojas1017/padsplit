import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useBookings } from '@/contexts/BookingsContext';
import { useAgents } from '@/contexts/AgentsContext';
import { TeamScoreCard } from '@/components/coaching/TeamScoreCard';
import { RatingDistributionChart } from '@/components/coaching/RatingDistributionChart';
import { CommonPatternsSection } from '@/components/coaching/CommonPatternsSection';
import { AgentFeedbackCard } from '@/components/coaching/AgentFeedbackCard';
import { AgentDetailSheet } from '@/components/coaching/AgentDetailSheet';
import { SiteFilter } from '@/components/dashboard/SiteFilter';
import { 
  calculateTeamAverageScores, 
  getRatingDistribution, 
  getCommonPatterns,
  getAgentFeedbackSummaries,
  getBookingsWithFeedback 
} from '@/utils/coachingCalculations';
import { MessageSquare, Mic, Users, BarChart3, GraduationCap } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Agent } from '@/types';

export default function CoachingHub() {
  const { user } = useAuth();
  const { bookings, isLoading: bookingsLoading } = useBookings();
  const { agents, isLoading: agentsLoading } = useAgents();
  
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const isLoading = bookingsLoading || agentsLoading;

  // Filter by site for supervisors (they only see their site)
  const filteredAgents = useMemo(() => {
    let filtered = agents;
    
    // Supervisors can only see their site's agents
    if (user?.role === 'supervisor' && user.siteId) {
      filtered = agents.filter(a => a.siteId === user.siteId);
    } else if (selectedSiteId) {
      filtered = agents.filter(a => a.siteId === selectedSiteId);
    }
    
    return filtered;
  }, [agents, selectedSiteId, user]);

  const filteredBookings = useMemo(() => {
    const agentIds = new Set(filteredAgents.map(a => a.id));
    return bookings.filter(b => agentIds.has(b.agentId));
  }, [bookings, filteredAgents]);

  // Calculate all metrics
  const teamScores = useMemo(() => calculateTeamAverageScores(filteredBookings), [filteredBookings]);
  const ratingDistribution = useMemo(() => getRatingDistribution(filteredBookings), [filteredBookings]);
  const patterns = useMemo(() => getCommonPatterns(filteredBookings), [filteredBookings]);
  const agentSummaries = useMemo(() => getAgentFeedbackSummaries(filteredBookings, filteredAgents), [filteredBookings, filteredAgents]);
  const transcribedCallsCount = useMemo(() => getBookingsWithFeedback(filteredBookings).length, [filteredBookings]);

  const handleViewDetails = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (agent) {
      setSelectedAgent(agent);
      setSheetOpen(true);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Coaching Hub" subtitle="Loading coaching data...">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Skeleton className="lg:col-span-2 h-[300px] rounded-xl" />
          <Skeleton className="h-[300px] rounded-xl" />
        </div>
      </DashboardLayout>
    );
  }

  const showSiteFilter = user?.role === 'super_admin' || user?.role === 'admin';

  return (
    <DashboardLayout
      title="Coaching Hub"
      subtitle="AI-powered coaching insights from call transcriptions"
      actions={
        showSiteFilter ? (
          <SiteFilter onSiteChange={setSelectedSiteId} />
        ) : undefined
      }
    >
      {/* Summary Stats */}
      <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 flex flex-wrap items-center gap-6 animate-slide-up">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/20">
            <GraduationCap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{transcribedCallsCount}</p>
            <p className="text-xs text-muted-foreground">Transcribed Calls</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-success/20">
            <Users className="w-5 h-5 text-success" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{agentSummaries.length}</p>
            <p className="text-xs text-muted-foreground">Agents with Feedback</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent/20">
            <BarChart3 className="w-5 h-5 text-accent" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">
              {((teamScores.communication + teamScores.productKnowledge + teamScores.objectionHandling + teamScores.closingSkills) / 4).toFixed(1)}
            </p>
            <p className="text-xs text-muted-foreground">Team Avg Score</p>
          </div>
        </div>
      </div>

      {transcribedCallsCount === 0 ? (
        <div className="text-center py-16 bg-card rounded-xl border border-border">
          <MessageSquare className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Coaching Data Yet</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Coaching insights will appear here once calls have been transcribed and analyzed. 
            Go to the Reports page and transcribe some calls to get started.
          </p>
        </div>
      ) : (
        <>
          {/* Team Scores */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <TeamScoreCard 
              label="Communication" 
              score={teamScores.communication} 
              icon={<MessageSquare className="w-5 h-5 text-primary" />}
              delay={0}
            />
            <TeamScoreCard 
              label="Product Knowledge" 
              score={teamScores.productKnowledge} 
              icon={<Mic className="w-5 h-5 text-success" />}
              delay={100}
            />
            <TeamScoreCard 
              label="Objection Handling" 
              score={teamScores.objectionHandling} 
              icon={<Users className="w-5 h-5 text-warning" />}
              delay={200}
            />
            <TeamScoreCard 
              label="Closing Skills" 
              score={teamScores.closingSkills} 
              icon={<BarChart3 className="w-5 h-5 text-accent" />}
              delay={300}
            />
          </div>

          {/* Rating Distribution & Patterns */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="bg-card rounded-xl p-5 border border-border shadow-card animate-slide-up" style={{ animationDelay: '200ms' }}>
              <h3 className="font-semibold text-foreground mb-4">Rating Distribution</h3>
              <RatingDistributionChart distribution={ratingDistribution} />
            </div>
            <div className="lg:col-span-2 animate-slide-up" style={{ animationDelay: '300ms' }}>
              <CommonPatternsSection strengths={patterns.strengths} improvements={patterns.improvements} />
            </div>
          </div>

          {/* Agent Feedback List */}
          <div className="animate-slide-up" style={{ animationDelay: '400ms' }}>
            <h3 className="font-semibold text-foreground mb-4">Agent Performance</h3>
            {agentSummaries.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No agent feedback data available</p>
            ) : (
              <div className="space-y-3">
                {agentSummaries
                  .sort((a, b) => {
                    // Sort by average score descending
                    const avgA = (a.avgScores.communication + a.avgScores.productKnowledge + a.avgScores.objectionHandling + a.avgScores.closingSkills) / 4;
                    const avgB = (b.avgScores.communication + b.avgScores.productKnowledge + b.avgScores.objectionHandling + b.avgScores.closingSkills) / 4;
                    return avgB - avgA;
                  })
                  .map((summary) => (
                    <AgentFeedbackCard 
                      key={summary.agent.id} 
                      summary={summary}
                      onViewDetails={handleViewDetails}
                    />
                  ))
                }
              </div>
            )}
          </div>
        </>
      )}

      {/* Agent Detail Sheet */}
      <AgentDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        agent={selectedAgent}
        bookings={filteredBookings}
      />
    </DashboardLayout>
  );
}
