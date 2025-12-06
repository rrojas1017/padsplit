import { Booking, Agent, AgentFeedback } from '@/types';
import { format } from 'date-fns';

// New interface for coaching data from booking_transcriptions
export interface CoachingBooking {
  id: string;
  bookingDate: Date;
  agentId: string;
  agentName: string;
  memberName?: string;
  transcriptionStatus: string;
  agentFeedback: AgentFeedback;
  coachingAudioUrl?: string | null;
  coachingAudioListenedAt?: string | null;
  coachingAudioGeneratedAt?: string | null;
  coachingAudioRegeneratedAt?: string | null;
}

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

export interface AgentCoachingStats {
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
  // Listening stats
  totalCoachingAudios: number;
  listenedCount: number;
  listenedPercentage: number;
  unlistenedCoachings: CoachingBooking[];
}

export interface ScoreTrendDataPoint {
  date: string;
  dateLabel: string;
  communication: number;
  productKnowledge: number;
  objectionHandling: number;
  closingSkills: number;
  callCount: number;
}

// Legacy function for backward compatibility with Booking type
export function getBookingsWithFeedback(bookings: Booking[]): Booking[] {
  return bookings.filter(b => b.agentFeedback && b.transcriptionStatus === 'completed');
}

// New function that works with CoachingBooking data
export function calculateTeamAverageScoresFromCoaching(coachingBookings: CoachingBooking[]): TeamScores {
  if (coachingBookings.length === 0) {
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

  coachingBookings.forEach(b => {
    const feedback = b.agentFeedback;
    if (feedback?.scores) {
      communication += feedback.scores.communication || 0;
      productKnowledge += feedback.scores.productKnowledge || 0;
      objectionHandling += feedback.scores.objectionHandling || 0;
      closingSkills += feedback.scores.closingSkills || 0;
    }
  });

  const count = coachingBookings.length;
  return {
    communication: Math.round((communication / count) * 10) / 10,
    productKnowledge: Math.round((productKnowledge / count) * 10) / 10,
    objectionHandling: Math.round((objectionHandling / count) * 10) / 10,
    closingSkills: Math.round((closingSkills / count) * 10) / 10,
    totalCalls: count,
  };
}

// Legacy function for backward compatibility
export function calculateTeamAverageScores(bookings: Booking[]): TeamScores {
  const feedbackBookings = getBookingsWithFeedback(bookings);
  return calculateTeamAverageScoresFromCoaching(
    feedbackBookings.map(b => ({
      id: b.id,
      bookingDate: b.bookingDate instanceof Date ? b.bookingDate : new Date(b.bookingDate),
      agentId: b.agentId,
      agentName: b.agentName,
      transcriptionStatus: b.transcriptionStatus || 'completed',
      agentFeedback: b.agentFeedback as AgentFeedback,
    }))
  );
}

export function calculateRatingDistributionFromCoaching(coachingBookings: CoachingBooking[]): RatingDistribution {
  const distribution: RatingDistribution = {
    excellent: 0,
    good: 0,
    needsImprovement: 0,
    poor: 0,
  };

  coachingBookings.forEach(b => {
    const feedback = b.agentFeedback;
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

// Legacy function
export function calculateRatingDistribution(bookings: Booking[]): RatingDistribution {
  const feedbackBookings = getBookingsWithFeedback(bookings);
  return calculateRatingDistributionFromCoaching(
    feedbackBookings.map(b => ({
      id: b.id,
      bookingDate: b.bookingDate instanceof Date ? b.bookingDate : new Date(b.bookingDate),
      agentId: b.agentId,
      agentName: b.agentName,
      transcriptionStatus: b.transcriptionStatus || 'completed',
      agentFeedback: b.agentFeedback as AgentFeedback,
    }))
  );
}

export function getCommonStrengthsFromCoaching(coachingBookings: CoachingBooking[], limit: number = 5): { strength: string; count: number }[] {
  const strengthCounts: Record<string, number> = {};

  coachingBookings.forEach(b => {
    const feedback = b.agentFeedback;
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

export function getCommonImprovementsFromCoaching(coachingBookings: CoachingBooking[], limit: number = 5): { improvement: string; count: number }[] {
  const improvementCounts: Record<string, number> = {};

  coachingBookings.forEach(b => {
    const feedback = b.agentFeedback;
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

// Legacy functions
export function getCommonStrengths(bookings: Booking[], limit: number = 5): { strength: string; count: number }[] {
  const feedbackBookings = getBookingsWithFeedback(bookings);
  return getCommonStrengthsFromCoaching(
    feedbackBookings.map(b => ({
      id: b.id,
      bookingDate: b.bookingDate instanceof Date ? b.bookingDate : new Date(b.bookingDate),
      agentId: b.agentId,
      agentName: b.agentName,
      transcriptionStatus: b.transcriptionStatus || 'completed',
      agentFeedback: b.agentFeedback as AgentFeedback,
    })),
    limit
  );
}

export function getCommonImprovements(bookings: Booking[], limit: number = 5): { improvement: string; count: number }[] {
  const feedbackBookings = getBookingsWithFeedback(bookings);
  return getCommonImprovementsFromCoaching(
    feedbackBookings.map(b => ({
      id: b.id,
      bookingDate: b.bookingDate instanceof Date ? b.bookingDate : new Date(b.bookingDate),
      agentId: b.agentId,
      agentName: b.agentName,
      transcriptionStatus: b.transcriptionStatus || 'completed',
      agentFeedback: b.agentFeedback as AgentFeedback,
    })),
    limit
  );
}


export function getAgentCoachingStatsFromCoaching(coachingBookings: CoachingBooking[], agents: Agent[]): AgentCoachingStats[] {
  const agentStats: AgentCoachingStats[] = [];

  agents.forEach(agent => {
    const agentBookings = coachingBookings.filter(b => b.agentId === agent.id);
    
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

    // Listening stats tracking
    const bookingsWithAudio = agentBookings.filter(b => b.coachingAudioUrl);
    const listenedBookings = bookingsWithAudio.filter(b => b.coachingAudioListenedAt);
    const unlistenedBookings = bookingsWithAudio.filter(b => !b.coachingAudioListenedAt);

    agentBookings.forEach(b => {
      const feedback = b.agentFeedback;
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
    
    const totalCoachingAudios = bookingsWithAudio.length;
    const listenedCount = listenedBookings.length;
    const listenedPercentage = totalCoachingAudios > 0 
      ? Math.round((listenedCount / totalCoachingAudios) * 100) 
      : 0;

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
      totalCoachingAudios,
      listenedCount,
      listenedPercentage,
      unlistenedCoachings: unlistenedBookings.sort((a, b) => 
        new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime()
      ),
    });
  });

  return agentStats.sort((a, b) => b.averageScores.overall - a.averageScores.overall);
}

// Calculate team-wide listening stats
export function calculateTeamListeningStats(agentStats: AgentCoachingStats[]): {
  totalCoachingAudios: number;
  totalListened: number;
  overallPercentage: number;
  unlistenedCount: number;
  mostEngagedAgent: { name: string; percentage: number } | null;
} {
  const totalCoachingAudios = agentStats.reduce((sum, a) => sum + a.totalCoachingAudios, 0);
  const totalListened = agentStats.reduce((sum, a) => sum + a.listenedCount, 0);
  const unlistenedCount = totalCoachingAudios - totalListened;
  const overallPercentage = totalCoachingAudios > 0 
    ? Math.round((totalListened / totalCoachingAudios) * 100) 
    : 0;
  
  // Find most engaged agent (min 1 audio required)
  const agentsWithAudio = agentStats.filter(a => a.totalCoachingAudios > 0);
  const mostEngaged = agentsWithAudio.length > 0 
    ? agentsWithAudio.reduce((best, curr) => 
        curr.listenedPercentage > best.listenedPercentage ? curr : best
      )
    : null;

  return {
    totalCoachingAudios,
    totalListened,
    overallPercentage,
    unlistenedCount,
    mostEngagedAgent: mostEngaged 
      ? { name: mostEngaged.agentName, percentage: mostEngaged.listenedPercentage }
      : null,
  };
}

// Legacy function
export function getAgentCoachingStats(bookings: Booking[], agents: Agent[]): AgentCoachingStats[] {
  const feedbackBookings = getBookingsWithFeedback(bookings);
  return getAgentCoachingStatsFromCoaching(
    feedbackBookings.map(b => ({
      id: b.id,
      bookingDate: b.bookingDate instanceof Date ? b.bookingDate : new Date(b.bookingDate),
      agentId: b.agentId,
      agentName: b.agentName,
      transcriptionStatus: b.transcriptionStatus || 'completed',
      agentFeedback: b.agentFeedback as AgentFeedback,
    })),
    agents
  );
}

export function getAgentDetailedFeedbackFromCoaching(coachingBookings: CoachingBooking[], agentId: string): {
  booking: CoachingBooking;
  feedback: AgentFeedback;
}[] {
  return coachingBookings
    .filter(b => b.agentId === agentId)
    .map(b => ({
      booking: b,
      feedback: b.agentFeedback,
    }))
    .sort((a, b) => new Date(b.booking.bookingDate).getTime() - new Date(a.booking.bookingDate).getTime());
}

// Legacy function
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

export function calculateScoresTrendFromCoaching(coachingBookings: CoachingBooking[]): ScoreTrendDataPoint[] {
  if (coachingBookings.length === 0) return [];

  // Group by date
  const dateGroups: Record<string, CoachingBooking[]> = {};
  coachingBookings.forEach(b => {
    const bookingDate = b.bookingDate instanceof Date 
      ? b.bookingDate 
      : new Date(b.bookingDate + 'T00:00:00');
    const dateKey = format(bookingDate, 'yyyy-MM-dd');
    if (!dateGroups[dateKey]) dateGroups[dateKey] = [];
    dateGroups[dateKey].push(b);
  });

  // Calculate average scores for each date
  return Object.entries(dateGroups)
    .map(([date, dayBookings]) => {
      let communication = 0;
      let productKnowledge = 0;
      let objectionHandling = 0;
      let closingSkills = 0;

      dayBookings.forEach(b => {
        const feedback = b.agentFeedback;
        if (feedback?.scores) {
          communication += feedback.scores.communication || 0;
          productKnowledge += feedback.scores.productKnowledge || 0;
          objectionHandling += feedback.scores.objectionHandling || 0;
          closingSkills += feedback.scores.closingSkills || 0;
        }
      });

      const count = dayBookings.length;
      return {
        date,
        dateLabel: format(new Date(date + 'T00:00:00'), 'MMM d'),
        communication: Math.round((communication / count) * 10) / 10,
        productKnowledge: Math.round((productKnowledge / count) * 10) / 10,
        objectionHandling: Math.round((objectionHandling / count) * 10) / 10,
        closingSkills: Math.round((closingSkills / count) * 10) / 10,
        callCount: count,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function calculateAgentScoresTrendFromCoaching(coachingBookings: CoachingBooking[], agentId: string): ScoreTrendDataPoint[] {
  const agentBookings = coachingBookings.filter(b => b.agentId === agentId);
  return calculateScoresTrendFromCoaching(agentBookings);
}

// Legacy functions
export function calculateScoresTrend(bookings: Booking[]): ScoreTrendDataPoint[] {
  const feedbackBookings = getBookingsWithFeedback(bookings);
  return calculateScoresTrendFromCoaching(
    feedbackBookings.map(b => ({
      id: b.id,
      bookingDate: b.bookingDate instanceof Date ? b.bookingDate : new Date(b.bookingDate),
      agentId: b.agentId,
      agentName: b.agentName,
      transcriptionStatus: b.transcriptionStatus || 'completed',
      agentFeedback: b.agentFeedback as AgentFeedback,
    }))
  );
}

export function calculateAgentScoresTrend(bookings: Booking[], agentId: string): ScoreTrendDataPoint[] {
  const agentBookings = bookings.filter(b => b.agentId === agentId);
  return calculateScoresTrend(agentBookings);
}
