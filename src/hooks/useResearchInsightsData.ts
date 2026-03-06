import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ResearchInsightReport {
  id: string;
  status: string;
  total_records_analyzed: number;
  analysis_period: string | null;
  date_range_start: string | null;
  date_range_end: string | null;
  campaign_id: string | null;
  created_at: string;
  error_message: string | null;
  data: any;
}

export interface ProcessingStats {
  totalResearchRecords: number;
  processedRecords: number;
  pendingRecords: number;
  humanReviewCount: number;
}

export type DateRangeOption = 'thisWeek' | 'lastMonth' | 'thisMonth' | 'last3months' | 'allTime';

export function useResearchInsightsData() {
  const [reports, setReports] = useState<ResearchInsightReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<ResearchInsightReport | null>(null);
  const [processingStats, setProcessingStats] = useState<ProcessingStats>({
    totalResearchRecords: 0, processedRecords: 0, pendingRecords: 0, humanReviewCount: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const fetchProcessingStats = useCallback(async () => {
    try {
      // Count total research records with non-empty transcripts
      const { count: totalCount } = await supabase
        .from('booking_transcriptions')
        .select('id, bookings!inner(record_type, has_valid_conversation)', { count: 'exact', head: true })
        .not('call_transcription', 'is', null)
        .neq('call_transcription', '')
        .eq('bookings.record_type', 'research')
        .eq('bookings.has_valid_conversation', true);

      // Count processed records
      const { count: processedCount } = await supabase
        .from('booking_transcriptions')
        .select('id', { count: 'exact', head: true })
        .not('research_extraction', 'is', null);

      // Count human review records
      const { count: reviewCount } = await supabase
        .from('booking_transcriptions')
        .select('id', { count: 'exact', head: true })
        .eq('research_human_review', true);

      setProcessingStats({
        totalResearchRecords: totalCount || 0,
        processedRecords: processedCount || 0,
        pendingRecords: (totalCount || 0) - (processedCount || 0),
        humanReviewCount: reviewCount || 0,
      });
    } catch (error) {
      console.error('Error fetching processing stats:', error);
    }
  }, []);

  const fetchReports = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('research_insights')
        .select('id, status, total_records_analyzed, analysis_period, date_range_start, date_range_end, campaign_id, created_at, error_message')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setReports((data || []) as ResearchInsightReport[]);

      if (data && data.length > 0 && data[0].status === 'completed') {
        await fetchReportDetail(data[0].id);
      } else if (data && data.length > 0) {
        setSelectedReport(data[0] as ResearchInsightReport);
      } else {
        setSelectedReport(null);
      }
    } catch (error) {
      console.error('Error fetching research reports:', error);
      toast.error('Failed to load research insights');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchReportDetail = async (reportId: string) => {
    setIsLoadingDetail(true);
    try {
      const { data, error } = await supabase
        .from('research_insights')
        .select('*')
        .eq('id', reportId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setSelectedReport(data as ResearchInsightReport);
      }
    } catch (error) {
      console.error('Error fetching report detail:', error);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const generateReport = async (params: {
    campaignId?: string;
    dateRangeStart?: string;
    dateRangeEnd?: string;
    analysisPeriod?: string;
  }) => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-research-insights', {
        body: {
          campaign_id: params.campaignId || null,
          date_range_start: params.dateRangeStart || null,
          date_range_end: params.dateRangeEnd || null,
          analysis_period: params.analysisPeriod || 'allTime',
        }
      });

      if (error) {
        // supabase-js puts the response body in context for FunctionsHttpError
        const ctx = (error as any)?.context;
        let body: any = null;
        try {
          if (ctx?.json) body = await ctx.json();
          else if (ctx?.text) { const t = await ctx.text(); body = JSON.parse(t); }
        } catch {}
        
        if (body?.error?.includes?.('No processed research records')) {
          toast.error('No processed records yet. Click "Process All" to run AI extraction on research transcripts first.');
          return null;
        }
        throw error;
      }
      toast.info('Research insights generation started...');
      return data?.insight_id;
    } catch (error: any) {
      console.error('Error generating report:', error);
      // Try to extract message from FunctionsHttpError
      let msg = 'Failed to start research insights generation';
      try {
        const ctx = error?.context;
        if (ctx?.json) {
          const body = await ctx.json();
          if (body?.error) msg = body.error;
        }
      } catch {}
      toast.error(msg);
      return null;
    }
  };

  const triggerBackfill = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('batch-process-research-records', {
        body: {}
      });

      if (error) throw error;
      toast.info('Processing all records automatically...');
      
      // Start polling stats every 10 seconds until all records are processed
      const pollInterval = setInterval(async () => {
        await fetchProcessingStats();
      }, 10000);

      // Store interval ID so we can clear it later
      (window as any).__researchBackfillPoll = pollInterval;

      return data;
    } catch (error) {
      console.error('Error triggering backfill:', error);
      toast.error('Failed to start record processing');
      return null;
    }
  };

  const getReprocessCount = async (): Promise<number> => {
    try {
      const { data, error } = await supabase.functions.invoke('reset-research-processing', {
        body: { dryRun: true }
      });
      if (error) throw error;
      return data?.count || 0;
    } catch (error) {
      console.error('Error getting reprocess count:', error);
      return 0;
    }
  };

  const triggerReprocess = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('reset-research-processing', {
        body: {}
      });

      if (error) throw error;
      toast.info(`Reset ${data?.reset_count || 0} records. Reprocessing started...`);
      
      const pollInterval = setInterval(async () => {
        await fetchProcessingStats();
      }, 10000);
      (window as any).__researchBackfillPoll = pollInterval;

      return data;
    } catch (error) {
      console.error('Error triggering reprocess:', error);
      toast.error('Failed to start reprocessing');
      return null;
    }
  };

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchReports(), fetchProcessingStats()]);
  }, [fetchReports, fetchProcessingStats]);

  useEffect(() => {
    fetchReports();
    fetchProcessingStats();
  }, [fetchReports, fetchProcessingStats]);

  return {
    reports,
    selectedReport,
    processingStats,
    isLoading,
    isLoadingDetail,
    fetchReportDetail,
    generateReport,
    triggerBackfill,
    triggerReprocess,
    getReprocessCount,
    refresh,
    fetchProcessingStats,
  };
}
