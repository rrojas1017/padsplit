import { Booking, Agent, AgentFeedback } from '@/types';

export interface TeamScores {
  communication: number;
  productKnowledge: number;
  objectionHandling: number;
  closingSkills: number;
}

export interface RatingDistribution {
  excellent: number;
  good: number;
  needs_improvement: number;
  poor: number;
}

export interface PatternItem {
  text: string;
  count: number;
}

export interface AgentCoachingSummary {
  agent: Agent;
  transcribedCalls: number;
  avgScores: TeamScores;
  latestRating: AgentFeedback['overallRating'] | null;
  strengths: string[];
  improvements: string[];
  coachingTips: string[];
}

export function getBookingsWithFeedback(bookings: Booking[]): Booking[] {
  return bookings.filter(b => b.agentFeedback && b.transcriptionStatus === 'completed');
}

export function calculateTeamAverageScores(bookings: Booking[]): TeamScores {
  const bookingsWithFeedback = getBookingsWithFeedback(bookings);
  
  if (bookingsWithFeedback.length === 0) {
    return { communication: 0, productKnowledge: 0, objectionHandling: 0, closingSkills: 0 };
  }

  const totals = { communication: 0, productKnowledge: 0, objectionHandling: 0, closingSkills: 0 };
  
  bookingsWithFeedback.forEach(b => {
    const fb = b.agentFeedback as AgentFeedback;
    if (fb.scores) {
      totals.communication += fb.scores.communication || 0;
      totals.productKnowledge += fb.scores.productKnowledge || 0;
      totals.objectionHandling += fb.scores.objectionHandling || 0;
      totals.closingSkills += fb.scores.closingSkills || 0;
    }
  });

  const count = bookingsWithFeedback.length;
  return {
    communication: Math.round((totals.communication / count) * 10) / 10,
    productKnowledge: Math.round((totals.productKnowledge / count) * 10) / 10,
    objectionHandling: Math.round((totals.objectionHandling / count) * 10) / 10,
    closingSkills: Math.round((totals.closingSkills / count) * 10) / 10,
  };
}

export function getRatingDistribution(bookings: Booking[]): RatingDistribution {
  const bookingsWithFeedback = getBookingsWithFeedback(bookings);
  
  const distribution: RatingDistribution = {
    excellent: 0,
    good: 0,
    needs_improvement: 0,
    poor: 0,
  };

  bookingsWithFeedback.forEach(b => {
    const fb = b.agentFeedback as AgentFeedback;
    if (fb.overallRating) {
      distribution[fb.overallRating]++;
    }
  });

  return distribution;
}

export function getCommonPatterns(bookings: Booking[]): { strengths: PatternItem[]; improvements: PatternItem[] } {
  const bookingsWithFeedback = getBookingsWithFeedback(bookings);
  
  const strengthCounts: Record<string, number> = {};
  const improvementCounts: Record<string, number> = {};

  bookingsWithFeedback.forEach(b => {
    const fb = b.agentFeedback as AgentFeedback;
    fb.strengths?.forEach(s => {
      strengthCounts[s] = (strengthCounts[s] || 0) + 1;
    });
    fb.improvements?.forEach(i => {
      improvementCounts[i] = (improvementCounts[i] || 0) + 1;
    });
  });

  const strengths = Object.entries(strengthCounts)
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const improvements = Object.entries(improvementCounts)
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return { strengths, improvements };
}

export function getAgentFeedbackSummaries(bookings: Booking[], agents: Agent[]): AgentCoachingSummary[] {
  return agents.map(agent => {
    const agentBookings = bookings.filter(b => b.agentId === agent.id);
    const feedbackBookings = getBookingsWithFeedback(agentBookings);
    
    if (feedbackBookings.length === 0) {
      return {
        agent,
        transcribedCalls: 0,
        avgScores: { communication: 0, productKnowledge: 0, objectionHandling: 0, closingSkills: 0 },
        latestRating: null,
        strengths: [],
        improvements: [],
        coachingTips: [],
      };
    }

    // Calculate average scores
    const avgScores = calculateTeamAverageScores(agentBookings);

    // Get latest rating
    const sortedByDate = [...feedbackBookings].sort((a, b) => 
      new Date(b.transcribedAt || b.bookingDate).getTime() - new Date(a.transcribedAt || a.bookingDate).getTime()
    );
    const latestRating = (sortedByDate[0]?.agentFeedback as AgentFeedback)?.overallRating || null;

    // Aggregate strengths and improvements
    const strengthCounts: Record<string, number> = {};
    const improvementCounts: Record<string, number> = {};
    const allTips: string[] = [];

    feedbackBookings.forEach(b => {
      const fb = b.agentFeedback as AgentFeedback;
      fb.strengths?.forEach(s => {
        strengthCounts[s] = (strengthCounts[s] || 0) + 1;
      });
      fb.improvements?.forEach(i => {
        improvementCounts[i] = (improvementCounts[i] || 0) + 1;
      });
      fb.coachingTips?.forEach(t => {
        if (!allTips.includes(t)) allTips.push(t);
      });
    });

    const strengths = Object.entries(strengthCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([s]) => s);

    const improvements = Object.entries(improvementCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([s]) => s);

    return {
      agent,
      transcribedCalls: feedbackBookings.length,
      avgScores,
      latestRating,
      strengths,
      improvements,
      coachingTips: allTips.slice(0, 5),
    };
  }).filter(s => s.transcribedCalls > 0);
}

export function getScoreColor(score: number): string {
  if (score >= 8) return 'bg-success';
  if (score >= 6) return 'bg-primary';
  if (score >= 4) return 'bg-warning';
  return 'bg-destructive';
}

export function getScoreTextColor(score: number): string {
  if (score >= 8) return 'text-success';
  if (score >= 6) return 'text-primary';
  if (score >= 4) return 'text-warning';
  return 'text-destructive';
}

export function getRatingBadgeStyle(rating: AgentFeedback['overallRating'] | null): string {
  switch (rating) {
    case 'excellent': return 'bg-success/20 text-success';
    case 'good': return 'bg-primary/20 text-primary';
    case 'needs_improvement': return 'bg-warning/20 text-warning';
    case 'poor': return 'bg-destructive/20 text-destructive';
    default: return 'bg-muted text-muted-foreground';
  }
}

export function formatRating(rating: AgentFeedback['overallRating'] | null): string {
  switch (rating) {
    case 'excellent': return 'Excellent';
    case 'good': return 'Good';
    case 'needs_improvement': return 'Needs Improvement';
    case 'poor': return 'Poor';
    default: return 'N/A';
  }
}
