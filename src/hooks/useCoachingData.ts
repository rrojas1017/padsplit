import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAgents } from '@/contexts/AgentsContext';
import { AgentFeedback } from '@/types';

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
}

export interface CoachingBookingWithAudio extends CoachingBooking {
  coachingAudioUrl: string | null;
  coachingAudioGeneratedAt: string | null;
  coachingAudioListenedAt: string | null;
  marketCity: string | null;
  marketState: string | null;
}

interface UseCoachingDataOptions {
  agentId?: string;
  includeAudio?: boolean;
}

export function useCoachingData(options: UseCoachingDataOptions = {}) {
  const { user, isLoading: authLoading } = useAuth();
  const { agents } = useAgents();
  const [coachingBookings, setCoachingBookings] = useState<CoachingBooking[]>([]);
  const [coachingBookingsWithAudio, setCoachingBookingsWithAudio] = useState<CoachingBookingWithAudio[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { agentId, includeAudio = false } = options;

  useEffect(() => {
    if (authLoading || !user) return;

    const fetchCoachingData = async () => {
      setIsLoading(true);
      try {
        // Build query for booking_transcriptions with agent_feedback
        let query = supabase
          .from('booking_transcriptions')
          .select(`
            booking_id,
            agent_feedback,
            coaching_audio_url,
            coaching_audio_generated_at,
            coaching_audio_listened_at,
            bookings!inner (
              id,
              booking_date,
              agent_id,
              member_name,
              market_city,
              market_state,
              transcription_status,
              record_type
            )
          `)
          .not('agent_feedback', 'is', null)
          .neq('bookings.record_type', 'research')
          .order('coaching_audio_generated_at', { ascending: false, nullsFirst: false });

        const { data, error } = await query;

        if (error) {
          console.error('Error fetching coaching data:', error);
          setCoachingBookings([]);
          setCoachingBookingsWithAudio([]);
          return;
        }

        // Filter by agentId if provided (post-query filter due to nested join)
        let filteredData = data || [];
        if (agentId) {
          filteredData = filteredData.filter((item: any) => item.bookings.agent_id === agentId);
        }

        // Map to CoachingBooking format
        const mappedData: CoachingBooking[] = filteredData.map((item: any) => {
          const booking = item.bookings;
          const agent = agents.find(a => a.id === booking.agent_id);
          
          return {
            id: booking.id,
            bookingDate: new Date(booking.booking_date + 'T00:00:00'),
            agentId: booking.agent_id,
            agentName: agent?.name || 'Unknown Agent',
            memberName: booking.member_name || 'Unknown Member',
            transcriptionStatus: booking.transcription_status || 'completed',
            agentFeedback: item.agent_feedback as AgentFeedback,
            coachingAudioUrl: item.coaching_audio_url,
            coachingAudioListenedAt: item.coaching_audio_listened_at,
            coachingAudioGeneratedAt: item.coaching_audio_generated_at,
          };
        });

        setCoachingBookings(mappedData);

        // If audio data is needed, also populate the extended type
        if (includeAudio) {
          const mappedWithAudio: CoachingBookingWithAudio[] = filteredData.map((item: any) => {
            const booking = item.bookings;
            const agent = agents.find(a => a.id === booking.agent_id);
            
            return {
              id: booking.id,
              bookingDate: new Date(booking.booking_date + 'T00:00:00'),
              agentId: booking.agent_id,
              agentName: agent?.name || 'Unknown Agent',
              memberName: booking.member_name || 'Unknown Member',
              transcriptionStatus: booking.transcription_status || 'completed',
              agentFeedback: item.agent_feedback as AgentFeedback,
              coachingAudioUrl: item.coaching_audio_url,
              coachingAudioGeneratedAt: item.coaching_audio_generated_at,
              coachingAudioListenedAt: item.coaching_audio_listened_at,
              marketCity: booking.market_city,
              marketState: booking.market_state,
            };
          });
          setCoachingBookingsWithAudio(mappedWithAudio);
        }
      } catch (err) {
        console.error('Error in useCoachingData:', err);
        setCoachingBookings([]);
        setCoachingBookingsWithAudio([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCoachingData();
  }, [user, authLoading, agents, agentId, includeAudio]);

  return { coachingBookings, coachingBookingsWithAudio, isLoading };
}