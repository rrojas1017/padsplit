import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface BookingDetails {
  callTranscription?: string;
  callKeyPoints?: any;
  agentFeedback?: any;
}

// On-demand loading of heavy JSONB columns to reduce initial page load
export function useBookingDetails() {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [detailsCache, setDetailsCache] = useState<Record<string, BookingDetails>>({});

  const fetchBookingDetails = useCallback(async (bookingId: string): Promise<BookingDetails | null> => {
    // Check cache first
    if (detailsCache[bookingId]) {
      return detailsCache[bookingId];
    }

    setLoadingId(bookingId);
    
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('call_transcription, call_key_points, agent_feedback')
        .eq('id', bookingId)
        .single();

      if (error) throw error;

      const details: BookingDetails = {
        callTranscription: data?.call_transcription || undefined,
        callKeyPoints: data?.call_key_points || undefined,
        agentFeedback: data?.agent_feedback || undefined,
      };

      // Cache the result
      setDetailsCache(prev => ({ ...prev, [bookingId]: details }));
      
      return details;
    } catch (error) {
      console.error('Error fetching booking details:', error);
      return null;
    } finally {
      setLoadingId(null);
    }
  }, [detailsCache]);

  const clearCache = useCallback(() => {
    setDetailsCache({});
  }, []);

  return {
    fetchBookingDetails,
    isLoadingDetails: loadingId !== null,
    loadingBookingId: loadingId,
    clearCache,
  };
}
