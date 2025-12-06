import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAgents } from '@/contexts/AgentsContext';
import { AgentFeedback } from '@/types';

export interface CoachingBooking {
  id: string;
  bookingDate: Date;
  agentId: string;
  agentName: string;
  memberName: string;
  transcriptionStatus: string;
  agentFeedback: AgentFeedback;
}

export function useCoachingData() {
  const { user, isLoading: authLoading } = useAuth();
  const { agents } = useAgents();
  const [coachingBookings, setCoachingBookings] = useState<CoachingBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;

    const fetchCoachingData = async () => {
      setIsLoading(true);
      try {
        // Fetch bookings with transcriptions that have agent_feedback
        const { data, error } = await supabase
          .from('booking_transcriptions')
          .select(`
            booking_id,
            agent_feedback,
            bookings!inner (
              id,
              booking_date,
              agent_id,
              member_name,
              transcription_status
            )
          `)
          .not('agent_feedback', 'is', null);

        if (error) {
          console.error('Error fetching coaching data:', error);
          setCoachingBookings([]);
          return;
        }

        // Map to CoachingBooking format
        const mappedData: CoachingBooking[] = (data || []).map((item: any) => {
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
          };
        });

        setCoachingBookings(mappedData);
      } catch (err) {
        console.error('Error in useCoachingData:', err);
        setCoachingBookings([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCoachingData();
  }, [user, authLoading, agents]);

  return { coachingBookings, isLoading };
}
