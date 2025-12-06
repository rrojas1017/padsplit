import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { Booking } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { deduplicatedQuery, debounce } from '@/utils/databaseCircuitBreaker';

interface BookingsContextType {
  bookings: Booking[];
  isLoading: boolean;
  addBooking: (booking: Omit<Booking, 'id'>) => Promise<string | null>;
  updateBooking: (id: string, booking: Partial<Booking>) => Promise<void>;
  deleteBooking: (id: string) => Promise<void>;
  refreshBookings: (showLoading?: boolean) => Promise<void>;
}

const BookingsContext = createContext<BookingsContextType | undefined>(undefined);

export function BookingsProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const lastFetchRef = useRef<number>(0);
  const fetchInProgressRef = useRef<boolean>(false);

  const fetchBookings = useCallback(async (showLoading = true) => {
    // Prevent concurrent fetches
    if (fetchInProgressRef.current) {
      console.log('[BookingsContext] Fetch already in progress, skipping');
      return;
    }

    // Rate limit: minimum 5 seconds between fetches
    const now = Date.now();
    if (now - lastFetchRef.current < 5000) {
      console.log('[BookingsContext] Rate limited, skipping fetch');
      return;
    }

    try {
      fetchInProgressRef.current = true;
      if (showLoading) setIsLoading(true);
      
      // Limit to last 90 days to prevent database timeout
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const dateLimit = format(ninetyDaysAgo, 'yyyy-MM-dd');
      
      const result = await deduplicatedQuery('bookings-fetch', async () => {
        // OPTIMIZED: Exclude heavy JSONB columns (call_transcription, call_key_points, agent_feedback)
        // These are loaded on-demand when user opens transcription modal
        const { data, error } = await supabase
          .from('bookings')
          .select(`
            id, member_name, booking_date, move_in_date, agent_id, status,
            booking_type, market_city, market_state, communication_method,
            notes, hubspot_link, kixie_link, admin_profile_link, move_in_day_reach_out,
            created_by, created_at, call_summary,
            transcription_status, transcription_error_message, transcribed_at, 
            call_duration_seconds, coaching_audio_url, 
            coaching_audio_generated_at, coaching_audio_regenerated_at, call_type_id
          `)
          .gte('booking_date', dateLimit)
          .order('booking_date', { ascending: false })
          .limit(500);

        if (error) throw error;
        return data;
      });

      if (!result) {
        // Circuit breaker blocked the query
        return;
      }

      lastFetchRef.current = Date.now();

      const transformedBookings: Booking[] = (result || []).map((b: any) => ({
        id: b.id,
        moveInDate: new Date(b.move_in_date + 'T00:00:00'),
        bookingDate: new Date(b.booking_date + 'T00:00:00'),
        memberName: b.member_name,
        bookingType: b.booking_type,
        agentId: b.agent_id,
        agentName: '', // Resolved from AgentsContext at component level
        marketCity: b.market_city || '',
        marketState: b.market_state || '',
        communicationMethod: b.communication_method,
        status: b.status,
        notes: b.notes || undefined,
        hubspotLink: b.hubspot_link || undefined,
        kixieLink: b.kixie_link || undefined,
        adminProfileLink: b.admin_profile_link || undefined,
        moveInDayReachOut: b.move_in_day_reach_out || false,
        createdBy: b.created_by || undefined,
        createdAt: b.created_at ? new Date(b.created_at) : undefined,
        // Heavy JSONB columns excluded - loaded on-demand
        callTranscription: undefined,
        callSummary: b.call_summary || undefined,
        callKeyPoints: undefined,
        transcriptionStatus: b.transcription_status || undefined,
        transcriptionErrorMessage: b.transcription_error_message || undefined,
        transcribedAt: b.transcribed_at ? new Date(b.transcribed_at) : undefined,
        callDurationSeconds: b.call_duration_seconds || undefined,
        agentFeedback: undefined,
        coachingAudioUrl: b.coaching_audio_url || undefined,
        coachingAudioGeneratedAt: b.coaching_audio_generated_at ? new Date(b.coaching_audio_generated_at) : undefined,
        coachingAudioRegeneratedAt: b.coaching_audio_regenerated_at ? new Date(b.coaching_audio_regenerated_at) : undefined,
        callTypeId: b.call_type_id || undefined,
      }));

      setBookings(transformedBookings);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      fetchInProgressRef.current = false;
      setIsLoading(false);
    }
  }, []);

  // Debounced version for realtime updates
  const debouncedFetch = useCallback(
    debounce(() => fetchBookings(false), 2000),
    [fetchBookings]
  );

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setBookings([]);
      setIsLoading(false);
      return;
    }

    // Initial fetch with small delay for auth stabilization
    const initialFetchTimeout = setTimeout(() => {
      fetchBookings();
    }, 200);

    // Set up realtime subscription with debounced handler
    const channel = supabase
      .channel('bookings-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => {
          debouncedFetch();
        }
      )
      .subscribe();

    return () => {
      clearTimeout(initialFetchTimeout);
      supabase.removeChannel(channel);
    };
  }, [user, authLoading, fetchBookings, debouncedFetch]);

  const triggerAutoTranscription = async (bookingId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      supabase.functions.invoke('check-auto-transcription', {
        body: { bookingId }
      }).then(({ error }) => {
        if (error) {
          console.log('[Auto-transcription] Check skipped or failed:', error.message);
        }
      }).catch(() => {});
    } catch (error) {}
  };

  const addBooking = async (booking: Omit<Booking, 'id'>): Promise<string | null> => {
    const { data: userData } = await supabase.auth.getUser();
    
    const { data, error } = await supabase.from('bookings').insert({
      move_in_date: format(booking.moveInDate, 'yyyy-MM-dd'),
      booking_date: format(booking.bookingDate, 'yyyy-MM-dd'),
      member_name: booking.memberName,
      booking_type: booking.bookingType,
      agent_id: booking.agentId,
      market_city: booking.marketCity,
      market_state: booking.marketState,
      communication_method: booking.communicationMethod,
      status: booking.status,
      notes: booking.notes || null,
      hubspot_link: booking.hubspotLink || null,
      kixie_link: booking.kixieLink || null,
      admin_profile_link: booking.adminProfileLink || null,
      move_in_day_reach_out: booking.moveInDayReachOut || false,
      created_by: userData.user?.id || null,
    }).select('id').single();

    if (error) {
      console.error('Error adding booking:', error);
      throw error;
    }

    const bookingId = data?.id || null;

    if (bookingId && booking.kixieLink) {
      triggerAutoTranscription(bookingId);
    }

    await fetchBookings();
    return bookingId;
  };

  const updateBooking = async (id: string, updates: Partial<Booking>) => {
    const updateData: any = {};
    
    if (updates.moveInDate) updateData.move_in_date = format(updates.moveInDate, 'yyyy-MM-dd');
    if (updates.bookingDate) updateData.booking_date = format(updates.bookingDate, 'yyyy-MM-dd');
    if (updates.memberName) updateData.member_name = updates.memberName;
    if (updates.bookingType) updateData.booking_type = updates.bookingType;
    if (updates.agentId) updateData.agent_id = updates.agentId;
    if (updates.marketCity !== undefined) updateData.market_city = updates.marketCity;
    if (updates.marketState !== undefined) updateData.market_state = updates.marketState;
    if (updates.communicationMethod) updateData.communication_method = updates.communicationMethod;
    if (updates.status) updateData.status = updates.status;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.hubspotLink !== undefined) updateData.hubspot_link = updates.hubspotLink;
    if (updates.kixieLink !== undefined) updateData.kixie_link = updates.kixieLink;
    if (updates.adminProfileLink !== undefined) updateData.admin_profile_link = updates.adminProfileLink;
    if (updates.moveInDayReachOut !== undefined) updateData.move_in_day_reach_out = updates.moveInDayReachOut;

    const { error } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('Error updating booking:', error);
      throw error;
    }

    if (updates.kixieLink) {
      triggerAutoTranscription(id);
    }

    await fetchBookings();
  };

  const deleteBooking = async (id: string) => {
    const { error } = await supabase.from('bookings').delete().eq('id', id);

    if (error) {
      console.error('Error deleting booking:', error);
      throw error;
    }

    await fetchBookings();
  };

  const refreshBookings = async (showLoading = false) => {
    await fetchBookings(showLoading);
  };

  return (
    <BookingsContext.Provider value={{ bookings, isLoading, addBooking, updateBooking, deleteBooking, refreshBookings }}>
      {children}
    </BookingsContext.Provider>
  );
}

export function useBookings() {
  const context = useContext(BookingsContext);
  if (!context) {
    throw new Error('useBookings must be used within a BookingsProvider');
  }
  return context;
}
