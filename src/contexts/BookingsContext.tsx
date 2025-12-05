import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Booking } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

interface BookingsContextType {
  bookings: Booking[];
  isLoading: boolean;
  addBooking: (booking: Omit<Booking, 'id'>) => Promise<string | null>;
  updateBooking: (id: string, booking: Partial<Booking>) => Promise<void>;
  deleteBooking: (id: string) => Promise<void>;
  refreshBookings: () => Promise<void>;
}

const BookingsContext = createContext<BookingsContextType | undefined>(undefined);

export function BookingsProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBookings = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          agents!inner(name, site_id, sites(name))
        `)
        .order('booking_date', { ascending: false });

      if (error) {
        console.error('Error fetching bookings:', error);
        return;
      }

      const transformedBookings: Booking[] = (data || []).map((b: any) => ({
        id: b.id,
        moveInDate: new Date(b.move_in_date + 'T00:00:00'),
        bookingDate: new Date(b.booking_date + 'T00:00:00'),
        memberName: b.member_name,
        bookingType: b.booking_type,
        agentId: b.agent_id,
        agentName: b.agents?.name || 'Unknown',
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
        // Call transcription fields
        callTranscription: b.call_transcription || undefined,
        callSummary: b.call_summary || undefined,
        callKeyPoints: b.call_key_points || undefined,
        transcriptionStatus: b.transcription_status || undefined,
        transcribedAt: b.transcribed_at ? new Date(b.transcribed_at) : undefined,
        callDurationSeconds: b.call_duration_seconds || undefined,
        agentFeedback: b.agent_feedback || undefined,
      }));

      setBookings(transformedBookings);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Wait for auth to be ready
    if (authLoading) {
      return;
    }

    // If no user, clear bookings
    if (!user) {
      setBookings([]);
      setIsLoading(false);
      return;
    }

    // User is authenticated, fetch data
    fetchBookings();

    // Delayed re-fetch to ensure complete data on fresh login
    // This catches any JWT propagation timing issues with RLS
    const refreshTimeout = setTimeout(() => {
      fetchBookings();
    }, 500);

    // Set up realtime subscription
    const channel = supabase
      .channel('bookings-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => {
          fetchBookings();
        }
      )
      .subscribe();

    return () => {
      clearTimeout(refreshTimeout);
      supabase.removeChannel(channel);
    };
  }, [user, authLoading]);

  const triggerAutoTranscription = async (bookingId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      // Fire-and-forget - don't await, don't block
      supabase.functions.invoke('check-auto-transcription', {
        body: { bookingId }
      }).then(({ error }) => {
        if (error) {
          console.log('[Auto-transcription] Check skipped or failed:', error.message);
        } else {
          console.log('[Auto-transcription] Check completed for booking:', bookingId);
        }
      }).catch(() => {
        // Silently ignore errors - auto-transcription is optional
      });
    } catch (error) {
      // Silently ignore errors - auto-transcription is optional
    }
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

    // Trigger auto-transcription check if booking has kixie link
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

    // Trigger auto-transcription check if kixieLink was added/updated
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

  const refreshBookings = async () => {
    await fetchBookings();
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
