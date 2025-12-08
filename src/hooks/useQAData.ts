import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface QAScores {
  scores: Record<string, number>;
  total: number;
  maxTotal: number;
  percentage: number;
  rubricId: string;
  scoredAt: string;
}

export interface QABooking {
  id: string;
  bookingId: string;
  memberName: string;
  bookingDate: string;
  agentId: string;
  agentName: string;
  marketCity: string | null;
  marketState: string | null;
  qaScores: QAScores | null;
}

export interface QACategory {
  name: string;
  maxPoints: number;
  criteria: string;
}

export interface QARubric {
  id: string;
  name: string;
  categories: QACategory[];
  isActive: boolean;
}

interface UseQADataOptions {
  agentId?: string;
  includeUnscored?: boolean;
}

export function useQAData(options: UseQADataOptions = {}) {
  const { agentId, includeUnscored = false } = options;
  const { user } = useAuth();
  const [qaBookings, setQABookings] = useState<QABooking[]>([]);
  const [rubric, setRubric] = useState<QARubric | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        setIsLoading(true);

        // Fetch active rubric
        const { data: rubricData } = await supabase
          .from('qa_settings')
          .select('*')
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        if (rubricData) {
          setRubric({
            id: rubricData.id,
            name: rubricData.name,
            categories: rubricData.categories as unknown as QACategory[],
            isActive: rubricData.is_active ?? true,
          });
        }

        // Build query for transcriptions with QA scores - join agents directly
        let query = supabase
          .from('booking_transcriptions')
          .select(`
            id,
            booking_id,
            qa_scores,
            bookings!inner (
              id,
              member_name,
              booking_date,
              agent_id,
              market_city,
              market_state,
              agents!inner (
                id,
                name
              )
            )
          `);

        if (!includeUnscored) {
          query = query.not('qa_scores', 'is', null);
        }

        const { data: transcriptions, error } = await query;

        if (error) {
          console.error('Error fetching QA data:', error);
          return;
        }

        if (!transcriptions) {
          setQABookings([]);
          return;
        }

        // Map to QABooking format - agent name comes from joined query
        const mappedBookings: QABooking[] = transcriptions
          .filter(t => {
            const booking = t.bookings as any;
            if (agentId && booking.agent_id !== agentId) return false;
            return true;
          })
          .map(t => {
            const booking = t.bookings as any;
            const agent = booking.agents as any;
            return {
              id: t.id,
              bookingId: t.booking_id,
              memberName: booking.member_name,
              bookingDate: booking.booking_date,
              agentId: booking.agent_id,
              agentName: agent?.name || 'Unknown',
              marketCity: booking.market_city,
              marketState: booking.market_state,
              qaScores: t.qa_scores as unknown as QAScores | null,
            };
          });

        setQABookings(mappedBookings);
      } catch (error) {
        console.error('Error in useQAData:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user, agentId, includeUnscored]);

  return { qaBookings, rubric, isLoading };
}

// Calculate aggregate stats
export function calculateQAStats(bookings: QABooking[], rubric: QARubric | null) {
  const scoredBookings = bookings.filter(b => b.qaScores);
  
  if (scoredBookings.length === 0 || !rubric) {
    return {
      avgPercentage: 0,
      avgTotal: 0,
      maxTotal: rubric?.categories.reduce((sum, c) => sum + c.maxPoints, 0) || 0,
      categoryAverages: {} as Record<string, number>,
      totalCalls: 0,
    };
  }

  const maxTotal = rubric.categories.reduce((sum, c) => sum + c.maxPoints, 0);
  const avgPercentage = scoredBookings.reduce((sum, b) => sum + (b.qaScores?.percentage || 0), 0) / scoredBookings.length;
  const avgTotal = scoredBookings.reduce((sum, b) => sum + (b.qaScores?.total || 0), 0) / scoredBookings.length;

  // Calculate category averages
  const categoryAverages: Record<string, number> = {};
  for (const cat of rubric.categories) {
    const catTotal = scoredBookings.reduce((sum, b) => sum + (b.qaScores?.scores[cat.name] || 0), 0);
    categoryAverages[cat.name] = catTotal / scoredBookings.length;
  }

  return {
    avgPercentage: Math.round(avgPercentage * 10) / 10,
    avgTotal: Math.round(avgTotal * 10) / 10,
    maxTotal,
    categoryAverages,
    totalCalls: scoredBookings.length,
  };
}

// Get agent QA rankings - builds from booking data directly
export function getAgentQARankings(bookings: QABooking[]) {
  const agentStats: Record<string, { name: string; total: number; count: number }> = {};

  for (const booking of bookings) {
    if (!booking.qaScores) continue;
    
    if (!agentStats[booking.agentId]) {
      agentStats[booking.agentId] = { name: booking.agentName, total: 0, count: 0 };
    }
    
    agentStats[booking.agentId].total += booking.qaScores.percentage;
    agentStats[booking.agentId].count++;
  }

  // Calculate averages and sort
  const rankings = Object.entries(agentStats)
    .filter(([_, stats]) => stats.count > 0)
    .map(([agentId, stats]) => ({
      agentId,
      agentName: stats.name,
      avgPercentage: Math.round((stats.total / stats.count) * 10) / 10,
      callCount: stats.count,
    }))
    .sort((a, b) => b.avgPercentage - a.avgPercentage);

  return rankings;
}
