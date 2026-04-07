import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAgents } from '@/contexts/AgentsContext';
import { AgentFeedback } from '@/types';
import { getDateRangeFromFilter, DateRangeFilter as DateRangeFilterType, CustomDateRange as CalcCustomDateRange } from '@/utils/dashboardCalculations';
import { format } from 'date-fns';

export interface CoachingBooking {
  id: string;
  bookingDate: Date;
  analyzedAt?: string | null;
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
  analyzedAt: string | null;
  marketCity: string | null;
  marketState: string | null;
}

interface UseCoachingDataOptions {
  agentId?: string;
  includeAudio?: boolean;
  dateRange?: DateRangeFilterType;
  customDates?: CalcCustomDateRange;
}

const PAGE_SIZE = 1000;

async function fetchAllPages(dateRange?: DateRangeFilterType, customDates?: CalcCustomDateRange) {
  const allRows: any[] = [];
  let page = 0;
  let hasMore = true;

  // Compute date bounds if provided
  let startStr: string | undefined;
  let endStr: string | undefined;
  if (dateRange && dateRange !== 'all') {
    const { start, end } = getDateRangeFromFilter(dateRange, customDates);
    startStr = format(start, 'yyyy-MM-dd');
    endStr = format(end, 'yyyy-MM-dd');
  }

  while (hasMore) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('booking_transcriptions')
      .select(`
        booking_id,
        agent_feedback,
        coaching_audio_url,
        coaching_audio_generated_at,
        coaching_audio_listened_at,
        created_at,
        updated_at,
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
      .order('updated_at', { ascending: false })
      .range(from, to);

    // Apply server-side date filtering when a range is specified
    if (startStr && endStr) {
      query = query.gte('bookings.booking_date', startStr).lte('bookings.booking_date', endStr);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching coaching page', page, error);
      break;
    }

    if (data) {
      allRows.push(...data);
    }

    hasMore = (data?.length ?? 0) === PAGE_SIZE;
    page++;
  }

  return allRows;
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
        const allData = await fetchAllPages();

        let filteredData = allData;
        if (agentId) {
          filteredData = filteredData.filter((item: any) => item.bookings.agent_id === agentId);
        }

        const mappedData: CoachingBooking[] = filteredData.map((item: any) => {
          const booking = item.bookings;
          const agent = agents.find(a => a.id === booking.agent_id);
          const analyzedAt = item.coaching_audio_generated_at || item.updated_at || item.created_at || `${booking.booking_date}T00:00:00`;

          return {
            id: booking.id,
            bookingDate: new Date(booking.booking_date + 'T00:00:00'),
            analyzedAt,
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

        // Sort by derived analysis timestamp (newest first)
        mappedData.sort((a, b) => {
          const tsA = a.analyzedAt ? new Date(a.analyzedAt).getTime() : 0;
          const tsB = b.analyzedAt ? new Date(b.analyzedAt).getTime() : 0;
          return tsB - tsA;
        });

        setCoachingBookings(mappedData);

        if (includeAudio) {
          const mappedWithAudio: CoachingBookingWithAudio[] = filteredData.map((item: any) => {
            const booking = item.bookings;
            const agent = agents.find(a => a.id === booking.agent_id);
            const analyzedAt = item.coaching_audio_generated_at || item.updated_at || item.created_at || `${booking.booking_date}T00:00:00`;

            return {
              id: booking.id,
              bookingDate: new Date(booking.booking_date + 'T00:00:00'),
              analyzedAt,
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

          mappedWithAudio.sort((a, b) => {
            const tsA = a.analyzedAt ? new Date(a.analyzedAt).getTime() : 0;
            const tsB = b.analyzedAt ? new Date(b.analyzedAt).getTime() : 0;
            return tsB - tsA;
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
