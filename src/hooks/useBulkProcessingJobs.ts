import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BulkProcessingJob {
  id: string;
  job_name: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'stopped';
  total_records: number;
  processed_count: number;
  failed_count: number;
  skipped_count: number;
  current_booking_id: string | null;
  site_filter: 'vixicom_only' | 'non_vixicom' | 'all' | null;
  include_tts: boolean;
  pacing_seconds: number;
  error_log: Array<{
    bookingId: string;
    error: string;
    timestamp: string;
    retryable: boolean;
  }>;
  started_at: string | null;
  completed_at: string | null;
  paused_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface PendingStats {
  vixicom: number;
  nonVixicom: number;
  total: number;
  loading: boolean;
}

export function useBulkProcessingJobs() {
  const [jobs, setJobs] = useState<BulkProcessingJob[]>([]);
  const [activeJob, setActiveJob] = useState<BulkProcessingJob | null>(null);
  const [pendingStats, setPendingStats] = useState<PendingStats>({
    vixicom: 0,
    nonVixicom: 0,
    total: 0,
    loading: true
  });
  const [loading, setLoading] = useState(true);

  // Fetch all jobs
  const fetchJobs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('bulk_processing_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      
      // Type cast to handle the JSONB array properly
      const typedJobs = (data || []).map(job => ({
        ...job,
        error_log: Array.isArray(job.error_log) ? job.error_log : []
      })) as BulkProcessingJob[];
      
      setJobs(typedJobs);
      
      // Find active job (running or paused)
      const active = typedJobs.find(j => 
        j.status === 'running' || j.status === 'paused' || j.status === 'pending'
      );
      setActiveJob(active || null);
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch pending stats
  const fetchPendingStats = useCallback(async () => {
    setPendingStats(prev => ({ ...prev, loading: true }));
    try {
      // Get total pending
      const { count: totalCount } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .is('transcription_status', null)
        .not('kixie_link', 'is', null)
        .not('kixie_link', 'eq', '');
      
      // Get Vixicom pending count using raw query via RPC
      // For now, we'll estimate based on known site distribution
      // In production, create an RPC function for accurate counts
      const { data: vixicomAgents } = await supabase
        .from('agents')
        .select('id, sites!inner(name)')
        .ilike('sites.name', '%vixicom%');
      
      const vixicomAgentIds = (vixicomAgents || []).map((a: any) => a.id);
      
      let vixicomCount = 0;
      if (vixicomAgentIds.length > 0) {
        const { count } = await supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .is('transcription_status', null)
          .not('kixie_link', 'is', null)
          .not('kixie_link', 'eq', '')
          .in('agent_id', vixicomAgentIds);
        
        vixicomCount = count || 0;
      }
      
      setPendingStats({
        vixicom: vixicomCount,
        nonVixicom: (totalCount || 0) - vixicomCount,
        total: totalCount || 0,
        loading: false
      });
    } catch (err) {
      console.error('Failed to fetch pending stats:', err);
      setPendingStats(prev => ({ ...prev, loading: false }));
    }
  }, []);

  // Create a new job
  const createJob = useCallback(async (params: {
    jobName: string;
    siteFilter: 'vixicom_only' | 'non_vixicom' | 'all';
    includeTts: boolean;
    pacingSeconds: number;
  }): Promise<BulkProcessingJob | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('bulk_processing_jobs')
        .insert({
          job_name: params.jobName,
          site_filter: params.siteFilter,
          include_tts: params.includeTts,
          pacing_seconds: params.pacingSeconds,
          status: 'pending',
          created_by: user?.id
        })
        .select()
        .single();
      
      if (error) throw error;
      
      await fetchJobs();
      return data as BulkProcessingJob;
    } catch (err) {
      console.error('Failed to create job:', err);
      toast.error('Failed to create job');
      return null;
    }
  }, [fetchJobs]);

  // Start/resume a job
  const startJob = useCallback(async (jobId: string, action: 'start' | 'resume' = 'start') => {
    try {
      const { data, error } = await supabase.functions.invoke('bulk-transcription-processor', {
        body: { jobId, action }
      });
      
      if (error) throw error;
      
      toast.success(action === 'start' ? 'Processing started' : 'Processing resumed');
      await fetchJobs();
      return data;
    } catch (err) {
      console.error('Failed to start job:', err);
      toast.error('Failed to start job');
      return null;
    }
  }, [fetchJobs]);

  // Pause a job
  const pauseJob = useCallback(async (jobId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('bulk-transcription-processor', {
        body: { jobId, action: 'pause' }
      });
      
      if (error) throw error;
      
      toast.success('Processing paused');
      await fetchJobs();
      return data;
    } catch (err) {
      console.error('Failed to pause job:', err);
      toast.error('Failed to pause job');
      return null;
    }
  }, [fetchJobs]);

  // Stop a job
  const stopJob = useCallback(async (jobId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('bulk-transcription-processor', {
        body: { jobId, action: 'stop' }
      });
      
      if (error) throw error;
      
      toast.success('Processing stopped');
      await fetchJobs();
      return data;
    } catch (err) {
      console.error('Failed to stop job:', err);
      toast.error('Failed to stop job');
      return null;
    }
  }, [fetchJobs]);

  // Initial fetch
  useEffect(() => {
    fetchJobs();
    fetchPendingStats();
  }, [fetchJobs, fetchPendingStats]);

  // Poll for updates when there's an active job
  useEffect(() => {
    if (!activeJob || (activeJob.status !== 'running' && activeJob.status !== 'paused')) {
      return;
    }
    
    const interval = setInterval(() => {
      fetchJobs();
    }, 3000);
    
    return () => clearInterval(interval);
  }, [activeJob, fetchJobs]);

  return {
    jobs,
    activeJob,
    pendingStats,
    loading,
    createJob,
    startJob,
    pauseJob,
    stopJob,
    refreshJobs: fetchJobs,
    refreshStats: fetchPendingStats
  };
}
