import { Booking, Agent, AgentFeedback } from '@/types';

interface TeamScores {
  communication: number;
  productKnowledge: number;
  objectionHandling: number;
  closingSkills: number;
  totalCalls: number;
}

interface RatingDistribution {
  excellent: number;
  good: number;
  needsImprovement: number;
  poor: number;
}

interface AgentCoachingStats {
  agentId: string;
  agentName: string;
  siteName: string;
  callCount: number;
  averageScores: {
    communication: number;
    productKnowledge: number;
    objectionHandling: number;
    closingSkills: number;
    overall: number;
  };
  ratingDistribution: RatingDistribution;
  recentStrengths: string[];
  recentImprovements: string[];
  recentTips: string[];
}

export function getBookingsWithFeedback(bookings: Booking[]): Booking[] {
  return bookings.filter(b => b.agentFeedback && b.transcriptionStatus === 'completed');
}

export function calculateTeamAverageScores(bookings: Booking[]): TeamScores {
  const feedbackBookings = getBookingsWithFeedback(bookings);
  
  if (feedbackBookings.length === 0) {
    return {
      communication: 0,
      productKnowledge: 0,
      objectionHandling: 0,
      closingSkills: 0,
      totalCalls: 0,
    };
  }

  let communication = 0;
  let productKnowledge = 0;
  let objectionHandling = 0;
  let closingSkills = 0;

  feedbackBookings.forEach(b => {
    const feedback = b.agentFeedback as AgentFeedback;
    if (feedback?.scores) {
      communication += feedback.scores.communication || 0;
      productKnowledge += feedback.scores.productKnowledge || 0;
      objectionHandling += feedback.scores.objectionHandling || 0;
      closingSkills += feedback.scores.closingSkills || 0;
    }
  });

  const count = feedbackBookings.length;
  return {
    communication: Math.round((communication / count) * 10) / 10,
    productKnowledge: Math.round((productKnowledge / count) * 10) / 10,
    objectionHandling: Math.round((objectionHandling / count) * 10) / 10,
    closingSkills: Math.round((closingSkills / count) * 10) / 10,
    totalCalls: count,
  };
}

export function calculateRatingDistribution(bookings: Booking[]): RatingDistribution {
  const feedbackBookings = getBookingsWithFeedback(bookings);
  
  const distribution: RatingDistribution = {
    excellent: 0,
    good: 0,
    needsImprovement: 0,
    poor: 0,
  };

  feedbackBookings.forEach(b => {
    const feedback = b.agentFeedback as AgentFeedback;
    if (feedback?.overallRating) {
      switch (feedback.overallRating) {
        case 'excellent':
          distribution.excellent++;
          break;
        case 'good':
          distribution.good++;
          break;
        case 'needs_improvement':
          distribution.needsImprovement++;
          break;
        case 'poor':
          distribution.poor++;
          break;
      }
    }
  });

  return distribution;
}

export function getCommonStrengths(bookings: Booking[], limit: number = 5): { strength: string; count: number }[] {
  const feedbackBookings = getBookingsWithFeedback(bookings);
  const strengthCounts: Record<string, number> = {};

  feedbackBookings.forEach(b => {
    const feedback = b.agentFeedback as AgentFeedback;
    if (feedback?.strengths) {
      feedback.strengths.forEach(strength => {
        const normalized = strength.toLowerCase().trim();
        strengthCounts[normalized] = (strengthCounts[normalized] || 0) + 1;
      });
    }
  });

  return Object.entries(strengthCounts)
    .map(([strength, count]) => ({ strength, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function getCommonImprovements(bookings: Booking[], limit: number = 5): { improvement: string; count: number }[] {
  const feedbackBookings = getBookingsWithFeedback(bookings);
  const improvementCounts: Record<string, number> = {};

  feedbackBookings.forEach(b => {
    const feedback = b.agentFeedback as AgentFeedback;
    if (feedback?.improvements) {
      feedback.improvements.forEach(improvement => {
        const normalized = improvement.toLowerCase().trim();
        improvementCounts[normalized] = (improvementCounts[normalized] || 0) + 1;
      });
    }
  });

  return Object.entries(improvementCounts)
    .map(([improvement, count]) => ({ improvement, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function getAgentCoachingStats(bookings: Booking[], agents: Agent[]): AgentCoachingStats[] {
  const agentStats: AgentCoachingStats[] = [];

  agents.forEach(agent => {
    const agentBookings = getBookingsWithFeedback(bookings.filter(b => b.agentId === agent.id));
    
    if (agentBookings.length === 0) {
      return;
    }

    let communication = 0;
    let productKnowledge = 0;
    let objectionHandling = 0;
    let closingSkills = 0;
    const distribution: RatingDistribution = { excellent: 0, good: 0, needsImprovement: 0, poor: 0 };
    const strengths: string[] = [];
    const improvements: string[] = [];
    const tips: string[] = [];

    agentBookings.forEach(b => {
      const feedback = b.agentFeedback as AgentFeedback;
      if (feedback?.scores) {
        communication += feedback.scores.communication || 0;
        productKnowledge += feedback.scores.productKnowledge || 0;
        objectionHandling += feedback.scores.objectionHandling || 0;
        closingSkills += feedback.scores.closingSkills || 0;
      }
      if (feedback?.overallRating) {
        switch (feedback.overallRating) {
          case 'excellent': distribution.excellent++; break;
          case 'good': distribution.good++; break;
          case 'needs_improvement': distribution.needsImprovement++; break;
          case 'poor': distribution.poor++; break;
        }
      }
      if (feedback?.strengths) strengths.push(...feedback.strengths);
      if (feedback?.improvements) improvements.push(...feedback.improvements);
      if (feedback?.coachingTips) tips.push(...feedback.coachingTips);
    });

    const count = agentBookings.length;
    const avgComm = communication / count;
    const avgProd = productKnowledge / count;
    const avgObj = objectionHandling / count;
    const avgClose = closingSkills / count;

    agentStats.push({
      agentId: agent.id,
      agentName: agent.name,
      siteName: agent.siteName,
      callCount: count,
      averageScores: {
        communication: Math.round(avgComm * 10) / 10,
        productKnowledge: Math.round(avgProd * 10) / 10,
        objectionHandling: Math.round(avgObj * 10) / 10,
        closingSkills: Math.round(avgClose * 10) / 10,
        overall: Math.round(((avgComm + avgProd + avgObj + avgClose) / 4) * 10) / 10,
      },
      ratingDistribution: distribution,
      recentStrengths: [...new Set(strengths)].slice(0, 5),
      recentImprovements: [...new Set(improvements)].slice(0, 5),
      recentTips: [...new Set(tips)].slice(0, 5),
    });
  });

  return agentStats.sort((a, b) => b.averageScores.overall - a.averageScores.overall);
}

export function getAgentDetailedFeedback(bookings: Booking[], agentId: string): {
  booking: Booking;
  feedback: AgentFeedback;
}[] {
  return getBookingsWithFeedback(bookings.filter(b => b.agentId === agentId))
    .map(b => ({
      booking: b,
      feedback: b.agentFeedback as AgentFeedback,
    }))
    .sort((a, b) => new Date(b.booking.bookingDate).getTime() - new Date(a.booking.bookingDate).getTime());
}
