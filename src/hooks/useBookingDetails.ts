import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface BookingDetails {
  callTranscription?: string;
  callSummary?: string;
  callKeyPoints?: any;
  agentFeedback?: any;
  coachingAudioUrl?: string;
  coachingAudioGeneratedAt?: Date;
  coachingAudioRegeneratedAt?: Date;
  sttProvider?: string;
}

// On-demand loading of heavy data from booking_transcriptions table
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
      // Fetch from the new booking_transcriptions table
      const { data, error } = await supabase
        .from('booking_transcriptions')
        .select('call_transcription, call_summary, call_key_points, agent_feedback, coaching_audio_url, coaching_audio_generated_at, coaching_audio_regenerated_at, stt_provider')
        .eq('booking_id', bookingId)
        .maybeSingle();

      if (error) throw error;

      // If no record exists in booking_transcriptions, return empty details
      if (!data) {
        const emptyDetails: BookingDetails = {};
        setDetailsCache(prev => ({ ...prev, [bookingId]: emptyDetails }));
        return emptyDetails;
      }

      const details: BookingDetails = {
        callTranscription: data.call_transcription || undefined,
        callSummary: data.call_summary || undefined,
        callKeyPoints: data.call_key_points || undefined,
        agentFeedback: data.agent_feedback || undefined,
        coachingAudioUrl: data.coaching_audio_url || undefined,
        coachingAudioGeneratedAt: data.coaching_audio_generated_at ? new Date(data.coaching_audio_generated_at) : undefined,
        coachingAudioRegeneratedAt: data.coaching_audio_regenerated_at ? new Date(data.coaching_audio_regenerated_at) : undefined,
        sttProvider: (data as any).stt_provider || undefined,
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

  const clearCache = useCallback((bookingId?: string) => {
    if (bookingId) {
      setDetailsCache(prev => {
        const newCache = { ...prev };
        delete newCache[bookingId];
        return newCache;
      });
    } else {
      setDetailsCache({});
    }
  }, []);

  return {
    fetchBookingDetails,
    isLoadingDetails: loadingId !== null,
    loadingBookingId: loadingId,
    clearCache,
    detailsCache,
  };
}
