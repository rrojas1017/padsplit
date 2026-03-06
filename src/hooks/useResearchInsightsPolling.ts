import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface InsightProgress {
  totalChunks: number;
  completedChunks: number;
  totalRecords: number;
  currentPhase: 'analyzing' | 'synthesizing';
}

interface UseResearchInsightsPollingProps {
  onComplete: () => void;
  pollingInterval?: number;
}

export const useResearchInsightsPolling = ({ 
  onComplete, 
  pollingInterval = 10000 
}: UseResearchInsightsPollingProps) => {
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const activeInsightIdRef = useRef<string | null>(null);
  const [progress, setProgress] = useState<InsightProgress | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    activeInsightIdRef.current = null;
    setProgress(null);
  }, []);

  const startPolling = useCallback((insightId: string) => {
    stopPolling();
    activeInsightIdRef.current = insightId;
    console.log(`[Research Polling] Started for insight: ${insightId}`);

    pollingRef.current = setInterval(async () => {
      if (!activeInsightIdRef.current) {
        stopPolling();
        return;
      }

      try {
        const { data, error } = await supabase
          .from('research_insights')
          .select('status, total_records_analyzed, error_message, data')
          .eq('id', activeInsightIdRef.current)
          .single();

        if (error) {
          console.error('[Research Polling] Error:', error);
          return;
        }

        // Extract progress from data._progress
        const progressData = (data?.data as any)?._progress;
        if (progressData) {
          setProgress({
            totalChunks: progressData.totalChunks || 0,
            completedChunks: progressData.completedChunks || 0,
            totalRecords: progressData.totalRecords || 0,
            currentPhase: progressData.currentPhase || 'analyzing',
          });
        }

        console.log(`[Research Polling] Status: ${data?.status}, Records: ${data?.total_records_analyzed}`);

        if (data?.status === 'completed') {
          stopPolling();
          toast.success(`Research insights complete! Analyzed ${data.total_records_analyzed} records`);
          onComplete();
        } else if (data?.status === 'failed') {
          stopPolling();
          toast.error(data.error_message || 'Research insights generation failed');
          onComplete();
        }
      } catch (error) {
        console.error('[Research Polling] Error:', error);
      }
    }, pollingInterval);
  }, [onComplete, pollingInterval, stopPolling]);

  const checkExistingAnalysis = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('research_insights')
        .select('id, status')
        .eq('status', 'processing')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('[Research Polling] Error checking existing:', error);
        return null;
      }

      if (data) {
        console.log(`[Research Polling] Found existing processing: ${data.id}`);
        startPolling(data.id);
        return data.id;
      }

      return null;
    } catch (error) {
      console.error('[Research Polling] Error:', error);
      return null;
    }
  }, [startPolling]);

  useEffect(() => {
    return () => { stopPolling(); };
  }, [stopPolling]);

  return {
    startPolling,
    stopPolling,
    checkExistingAnalysis,
    isPolling: !!pollingRef.current,
    progress,
  };
};
