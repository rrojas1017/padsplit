import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Booking, CallKeyPoints, AgentFeedback } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useAgents } from '@/contexts/AgentsContext';

interface MyBookingsDataReturn {
  bookings: Booking[];
  isLoading: boolean;
  error: string | null;
  myAgent: { id: string; name: string; siteId: string } | null;
  updateBooking: (bookingId: string, updates: Partial<Booking>) => Promise<void>;
  refreshBookings: () => Promise<void>;
}

export function useMyBookingsData(): MyBookingsDataReturn {
  const { user } = useAuth();
  const { agents, isLoading: agentsLoading } = useAgents();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get the agent record for the current user
  const myAgent = useMemo(() => {
    if (!user) return null;
    const agent = agents.find(a => a.userId === user.id);
    if (!agent) return null;
    return { id: agent.id, name: agent.name, siteId: agent.siteId };
  }, [agents, user]);

  const fetchBookings = useCallback(async () => {
    console.log('[useMyBookingsData] fetchBookings called, myAgent:', myAgent?.id, 'agentsLoading:', agentsLoading);
    
    if (!myAgent) {
      if (!agentsLoading) {
        // Only set empty if agents have finished loading and user has no agent
        console.log('[useMyBookingsData] No agent found after agents loaded');
        setBookings([]);
        setIsLoading(false);
      }
      // Keep loading true while agents are still loading
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('[useMyBookingsData] Fetching bookings for agent:', myAgent.id);
      // Fetch bookings with transcription data joined
      const { data, error: fetchError } = await supabase
        .from('bookings')
        .select(`
          id,
          member_name,
          booking_date,
          move_in_date,
          agent_id,
          status,
          booking_type,
          communication_method,
          market_city,
          market_state,
          notes,
          hubspot_link,
          kixie_link,
          admin_profile_link,
          move_in_day_reach_out,
          created_by,
          created_at,
          is_rebooking,
          original_booking_id,
          transcription_status,
          transcription_error_message,
          transcribed_at,
          call_duration_seconds,
          contact_email,
          contact_phone,
          email_verified,
          email_verified_at,
          email_verification_status,
          call_type_id,
          booking_transcriptions (
            call_key_points,
            call_summary,
            agent_feedback,
            coaching_audio_url,
            coaching_audio_generated_at
          )
        `)
        .eq('agent_id', myAgent.id)
        .order('booking_date', { ascending: false });

      if (fetchError) throw fetchError;

      console.log('[useMyBookingsData] Fetched', data?.length, 'bookings');
      console.log('[useMyBookingsData] First booking transcription:', data?.[0]?.booking_transcriptions);

      // Transform data to match Booking interface
      const transformedBookings: Booking[] = (data || []).map(row => {
        const transcription = row.booking_transcriptions?.[0];
        
        return {
          id: row.id,
          memberName: row.member_name,
          bookingDate: new Date(row.booking_date + 'T00:00:00'),
          moveInDate: new Date(row.move_in_date + 'T00:00:00'),
          agentId: row.agent_id,
          agentName: myAgent.name,
          status: row.status as Booking['status'],
          bookingType: row.booking_type as Booking['bookingType'],
          communicationMethod: row.communication_method as Booking['communicationMethod'],
          marketCity: row.market_city || '',
          marketState: row.market_state || '',
          notes: row.notes || undefined,
          hubspotLink: row.hubspot_link || undefined,
          kixieLink: row.kixie_link || undefined,
          adminProfileLink: row.admin_profile_link || undefined,
          moveInDayReachOut: row.move_in_day_reach_out || undefined,
          createdBy: row.created_by || undefined,
          createdAt: row.created_at ? new Date(row.created_at) : undefined,
          isRebooking: row.is_rebooking || false,
          originalBookingId: row.original_booking_id || undefined,
          transcriptionStatus: row.transcription_status as Booking['transcriptionStatus'],
          transcriptionErrorMessage: row.transcription_error_message || undefined,
          transcribedAt: row.transcribed_at ? new Date(row.transcribed_at) : undefined,
          callDurationSeconds: row.call_duration_seconds || undefined,
          contactEmail: row.contact_email,
          contactPhone: row.contact_phone,
          emailVerified: row.email_verified,
          emailVerifiedAt: row.email_verified_at ? new Date(row.email_verified_at) : undefined,
          emailVerificationStatus: row.email_verification_status as Booking['emailVerificationStatus'],
          callTypeId: row.call_type_id || undefined,
          // Data from booking_transcriptions join
          callKeyPoints: transcription?.call_key_points as CallKeyPoints | undefined,
          callSummary: transcription?.call_summary || undefined,
          agentFeedback: transcription?.agent_feedback as AgentFeedback | undefined,
          coachingAudioUrl: transcription?.coaching_audio_url || undefined,
          coachingAudioGeneratedAt: transcription?.coaching_audio_generated_at 
            ? new Date(transcription.coaching_audio_generated_at) 
            : undefined,
        };
      });

      setBookings(transformedBookings);
    } catch (err) {
      console.error('Error fetching my bookings:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch bookings');
    } finally {
      setIsLoading(false);
    }
  }, [myAgent, agentsLoading]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const updateBooking = useCallback(async (bookingId: string, updates: Partial<Booking>) => {
    // Map Booking interface to database columns
    const dbUpdates: Record<string, unknown> = {};
    
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.moveInDate !== undefined) dbUpdates.move_in_date = updates.moveInDate instanceof Date 
      ? updates.moveInDate.toISOString().split('T')[0] 
      : updates.moveInDate;
    if (updates.isRebooking !== undefined) dbUpdates.is_rebooking = updates.isRebooking;
    if (updates.originalBookingId !== undefined) dbUpdates.original_booking_id = updates.originalBookingId;

    const { error: updateError } = await supabase
      .from('bookings')
      .update(dbUpdates)
      .eq('id', bookingId);

    if (updateError) throw updateError;

    // Refresh to get updated data
    await fetchBookings();
  }, [fetchBookings]);

  return {
    bookings,
    isLoading,
    error,
    myAgent,
    updateBooking,
    refreshBookings: fetchBookings,
  };
}
