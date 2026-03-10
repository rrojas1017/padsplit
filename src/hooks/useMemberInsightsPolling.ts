import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UseMemberInsightsPollingProps {
  onComplete: () => void;
  pollingInterval?: number;
}

export const useMemberInsightsPolling = ({ 
  onComplete, 
  pollingInterval = 10000 
}: UseMemberInsightsPollingProps) => {
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeInsightIdRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    activeInsightIdRef.current = null;
  }, []);

  const startPolling = useCallback((insightId: string) => {
    // Stop any existing polling
    stopPolling();
    
    activeInsightIdRef.current = insightId;
    console.log(`[Polling] Started polling for insight: ${insightId}`);

    pollingRef.current = setInterval(async () => {
      if (!activeInsightIdRef.current) {
        stopPolling();
        return;
      }

      try {
        const { data, error } = await supabase
          .from('member_insights')
          .select('status, total_calls_analyzed, error_message')
          .eq('id', activeInsightIdRef.current)
          .single();

        if (error) {
          console.error('[Polling] Error checking status:', error);
          return;
        }

        console.log(`[Polling] Status: ${data?.status}, Calls: ${data?.total_calls_analyzed}`);

        if (data?.status === 'completed') {
          stopPolling();
          toast.success(`Analysis complete! Analyzed ${data.total_calls_analyzed} calls`);
          onComplete();
        } else if (data?.status === 'failed') {
          stopPolling();
          toast.error(data.error_message || 'Analysis failed');
          onComplete();
        }
      } catch (error) {
        console.error('[Polling] Error:', error);
      }
    }, pollingInterval);
  }, [onComplete, pollingInterval, stopPolling]);

  // Check for any in-progress analyses on mount
  const checkExistingAnalysis = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('member_insights')
        .select('id, status')
        .eq('status', 'processing')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('[Polling] Error checking existing:', error);
        return null;
      }

      if (data) {
        console.log(`[Polling] Found existing processing analysis: ${data.id}`);
        startPolling(data.id);
        return data.id;
      }

      return null;
    } catch (error) {
      console.error('[Polling] Error:', error);
      return null;
    }
  }, [startPolling]);

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
