import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UseNonBookingInsightsPollingProps {
  onComplete: () => void;
  pollingInterval?: number;
  maxPollingDurationMs?: number;
}

export const useNonBookingInsightsPolling = ({ 
  onComplete, 
  pollingInterval = 10000,
  maxPollingDurationMs = 5 * 60 * 1000 // 5 minutes default
}: UseNonBookingInsightsPollingProps) => {
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const activeInsightIdRef = useRef<string | null>(null);
  const pollingStartTimeRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    activeInsightIdRef.current = null;
    pollingStartTimeRef.current = null;
  }, []);

  const startPolling = useCallback((insightId: string) => {
    // Stop any existing polling
    stopPolling();
    
    activeInsightIdRef.current = insightId;
    pollingStartTimeRef.current = Date.now();
    console.log(`[NonBookingPolling] Started polling for insight: ${insightId}`);

    pollingRef.current = setInterval(async () => {
      if (!activeInsightIdRef.current) {
        stopPolling();
        return;
      }

      // Check if polling has exceeded max duration
      const pollingDuration = Date.now() - (pollingStartTimeRef.current || Date.now());
      if (pollingDuration > maxPollingDurationMs) {
        console.warn(`[NonBookingPolling] Polling timeout after ${pollingDuration}ms`);
        stopPolling();
        toast.error('Analysis is taking longer than expected. Please check back later or try again.');
        onComplete();
        return;
      }

      try {
        const { data, error } = await supabase
          .from('non_booking_insights')
          .select('status, total_calls_analyzed, error_message')
          .eq('id', activeInsightIdRef.current)
          .single();

        if (error) {
          console.error('[NonBookingPolling] Error checking status:', error);
          return;
        }

        console.log(`[NonBookingPolling] Status: ${data?.status}, Calls: ${data?.total_calls_analyzed}`);

        if (data?.status === 'completed') {
          stopPolling();
          toast.success(`Non-Booking analysis complete! Analyzed ${data.total_calls_analyzed} calls`);
          onComplete();
        } else if (data?.status === 'failed') {
          stopPolling();
          toast.error(data.error_message || 'Non-Booking analysis failed');
          onComplete();
        }
      } catch (error) {
        console.error('[NonBookingPolling] Error:', error);
      }
    }, pollingInterval);
  }, [onComplete, pollingInterval, maxPollingDurationMs, stopPolling]);

  // Check for any in-progress analyses on mount
  const checkExistingAnalysis = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('non_booking_insights')
        .select('id, status, created_at')
        .eq('status', 'processing')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('[NonBookingPolling] Error checking existing:', error);
        return null;
      }

      if (data) {
        // Check if the existing analysis is older than maxPollingDurationMs
        const createdAt = new Date(data.created_at).getTime();
        const age = Date.now() - createdAt;
        
        if (age > maxPollingDurationMs) {
          console.warn(`[NonBookingPolling] Found stale processing record (${age}ms old), marking as failed`);
          // Mark stale record as failed
          await supabase
            .from('non_booking_insights')
            .update({ 
              status: 'failed', 
              error_message: 'Analysis timed out - please try again' 
            })
            .eq('id', data.id);
          return null;
        }

        console.log(`[NonBookingPolling] Found existing processing analysis: ${data.id}`);
        startPolling(data.id);
        return data.id;
      }

      return null;
    } catch (error) {
      console.error('[NonBookingPolling] Error:', error);
      return null;
    }
  }, [startPolling, maxPollingDurationMs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    startPolling,
    stopPolling,
    checkExistingAnalysis,
    isPolling: !!pollingRef.current
  };
};
