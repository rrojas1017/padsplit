import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface QACoachingBooking {
  id: string;
  bookingId: string;
  bookingDate: Date;
  agentId: string;
  agentName: string;
  agentUserId?: string;
  memberName?: string;
  qaScores: {
    scores: Record<string, number>;
    total: number;
    maxTotal: number;
    percentage: number;
  } | null;
  qaCoachingAudioUrl?: string | null;
  qaCoachingAudioGeneratedAt?: string | null;
  qaCoachingAudioListenedAt?: string | null;
  marketCity?: string | null;
  marketState?: string | null;
  // Jeff's coaching fields
  agentFeedback?: Record<string, unknown> | null;
  coachingAudioUrl?: string | null;
  coachingAudioListenedAt?: string | null;
}

export interface UseQACoachingDataOptions {
  agentId?: string;
  includeUnscored?: boolean;
}

export function useQACoachingData(options: UseQACoachingDataOptions = {}) {
  const { agentId, includeUnscored = false } = options;
  const { user } = useAuth();
  const [qaCoachingBookings, setQACoachingBookings] = useState<QACoachingBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const fetchQACoachingData = async () => {
      try {
        setIsLoading(true);

        let query = supabase
          .from('booking_transcriptions')
          .select(`
            id,
            booking_id,
            qa_scores,
            qa_coaching_audio_url,
            qa_coaching_audio_generated_at,
            qa_coaching_audio_listened_at,
            agent_feedback,
            coaching_audio_url,
            coaching_audio_listened_at,
            bookings!inner(
              id,
              booking_date,
              agent_id,
              member_name,
              market_city,
              market_state,
              agents!inner(id, name, user_id)
            )
          `);

        // Filter by QA scores presence
        if (!includeUnscored) {
          query = query.not('qa_scores', 'is', null);
        }

        const { data, error } = await query.order('booking_id', { ascending: false });

        if (error) {
          console.error('Error fetching QA coaching data:', error);
          setQACoachingBookings([]);
          return;
        }

        if (!data) {
          setQACoachingBookings([]);
          return;
        }

        // Transform data
        let bookings: QACoachingBooking[] = data.map((item: any) => {
          const booking = item.bookings;
          const agent = booking?.agents;
          
          return {
            id: item.id,
            bookingId: item.booking_id,
            bookingDate: new Date(booking?.booking_date + 'T00:00:00'),
            agentId: booking?.agent_id || '',
            agentName: agent?.name || 'Unknown',
            agentUserId: agent?.user_id || undefined,
            memberName: booking?.member_name,
            qaScores: item.qa_scores,
            qaCoachingAudioUrl: item.qa_coaching_audio_url,
            qaCoachingAudioGeneratedAt: item.qa_coaching_audio_generated_at,
            qaCoachingAudioListenedAt: item.qa_coaching_audio_listened_at,
            marketCity: booking?.market_city,
            marketState: booking?.market_state,
            // Jeff's coaching fields
            agentFeedback: item.agent_feedback,
            coachingAudioUrl: item.coaching_audio_url,
            coachingAudioListenedAt: item.coaching_audio_listened_at,
          };
        });

        // Filter by agent if specified
        if (agentId) {
          bookings = bookings.filter(b => b.agentId === agentId);
        }

        setQACoachingBookings(bookings);
      } catch (error) {
        console.error('Error in fetchQACoachingData:', error);
        setQACoachingBookings([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchQACoachingData();
  }, [user, agentId, includeUnscored]);

  return { qaCoachingBookings, isLoading };
}

// Calculate QA coaching engagement stats
export function calculateQACoachingEngagement(bookings: QACoachingBooking[]) {
  const withAudio = bookings.filter(b => b.qaCoachingAudioUrl);
  const listened = withAudio.filter(b => b.qaCoachingAudioListenedAt);
  const pending = withAudio.filter(b => !b.qaCoachingAudioListenedAt);

  const listenedPercentage = withAudio.length > 0 
    ? Math.round((listened.length / withAudio.length) * 100) 
    : 0;

  return {
    totalWithAudio: withAudio.length,
    listened: listened.length,
    pending: pending.length,
    listenedPercentage,
  };
}

// Calculate per-agent QA coaching stats
export function getAgentQACoachingStats(bookings: QACoachingBooking[], agents: { id: string; name: string }[]) {
  const stats = agents.map(agent => {
    const agentBookings = bookings.filter(b => b.agentId === agent.id && b.qaCoachingAudioUrl);
    const listened = agentBookings.filter(b => b.qaCoachingAudioListenedAt);
    const percentage = agentBookings.length > 0 
      ? Math.round((listened.length / agentBookings.length) * 100)
      : 0;

    return {
      agentId: agent.id,
      agentName: agent.name,
      totalWithAudio: agentBookings.length,
      listened: listened.length,
      percentage,
    };
  });

  return stats.sort((a, b) => b.percentage - a.percentage);
}
