import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Declare EdgeRuntime for background tasks
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface JobConfig {
  jobId: string;
  action?: 'start' | 'pause' | 'resume' | 'stop';
}

interface ProcessingError {
  bookingId: string;
  error: string;
  timestamp: string;
  retryable: boolean;
}

// Check if an agent belongs to Vixicom site
async function isVixicomAgent(supabase: any, agentId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('agents')
      .select('sites!inner(name)')
      .eq('id', agentId)
      .single();
    
    if (error || !data) return false;
    
    const siteName = data.sites?.name || '';
    return siteName.toLowerCase().includes('vixicom');
  } catch {
    return false;
  }
}

// Get pending records based on job filter
async function getPendingBookings(
  supabase: any,
  siteFilter: string | null,
  limit: number = 100
): Promise<any[]> {
  let query = supabase
    .from('bookings')
    .select(`
      id,
      member_name,
      kixie_link,
      agent_id,
      agents!inner(
        id,
        name,
        site_id,
        sites!inner(name)
      )
    `)
    .is('transcription_status', null)
    .not('kixie_link', 'is', null)
    .not('kixie_link', 'eq', '')
    .order('booking_date', { ascending: false })
    .limit(limit);
  
  // Apply site filter
  if (siteFilter === 'vixicom_only') {
    query = query.ilike('agents.sites.name', '%vixicom%');
  } else if (siteFilter === 'non_vixicom') {
    query = query.not('agents.sites.name', 'ilike', '%vixicom%');
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('[BulkProcessor] Failed to fetch pending bookings:', error);
    return [];
  }
  
  return data || [];
}

// Update job progress
async function updateJobProgress(
  supabase: any,
  jobId: string,
  updates: Record<string, any>
): Promise<void> {
  const { error } = await supabase
    .from('bulk_processing_jobs')
    .update(updates)
    .eq('id', jobId);
  
  if (error) {
    console.error('[BulkProcessor] Failed to update job progress:', error);
  }
}

// Add error to job log
async function addJobError(
  supabase: any,
  jobId: string,
  error: ProcessingError
): Promise<void> {
  // Fetch current error_log
  const { data: job } = await supabase
    .from('bulk_processing_jobs')
    .select('error_log, failed_count')
    .eq('id', jobId)
    .single();
  
  const currentErrors = job?.error_log || [];
  const updatedErrors = [...currentErrors, error].slice(-100); // Keep last 100 errors
  
  await supabase
    .from('bulk_processing_jobs')
    .update({
      error_log: updatedErrors,
      failed_count: (job?.failed_count || 0) + 1
    })
    .eq('id', jobId);
}

// Process a single booking
async function processBooking(
  supabase: any,
  booking: any,
  includeTts: boolean,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
  const bookingId = booking.id;
  const kixieUrl = booking.kixie_link;
  const agentId = booking.agent_id;
  const siteName = booking.agents?.sites?.name || '';
  const isVixicom = siteName.toLowerCase().includes('vixicom');
  
  console.log(`[BulkProcessor] Processing booking ${bookingId} (Agent: ${booking.agents?.name}, Site: ${siteName})`);
  
  try {
    // Step 1: Call transcribe-call
    const transcribeResponse = await fetch(`${supabaseUrl}/functions/v1/transcribe-call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ 
        bookingId, 
        kixieUrl,
        // Pass flag to skip TTS if not Vixicom or TTS disabled
        skipTts: !includeTts || !isVixicom
      }),
    });
    
    if (!transcribeResponse.ok) {
      const status = transcribeResponse.status;
      const errorText = await transcribeResponse.text();
      
      // Check for specific error types
      if (status === 402) {
        return { success: false, error: `Quota exceeded (402): ${errorText}` };
      }
      if (status === 404) {
        return { success: false, error: `Audio not found (404)`, skipped: true };
      }
      if (status === 403) {
        return { success: false, error: `Access denied (403)`, skipped: true };
      }
      
      return { success: false, error: `Transcription failed (${status}): ${errorText}` };
    }
    
    console.log(`[BulkProcessor] Transcription started for ${bookingId}`);
    
    // Note: transcribe-call handles the full pipeline in background
    // (Jeff audio, QA scoring, Katty audio) based on skipTts flag
    
    return { success: true };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

// Main background processing loop
async function runProcessingLoop(
  supabase: any,
  jobId: string,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<void> {
  console.log(`[BulkProcessor] Starting processing loop for job ${jobId}`);
  
  try {
    // Get job config
    const { data: job, error: jobError } = await supabase
      .from('bulk_processing_jobs')
      .select('*')
      .eq('id', jobId)
      .single();
    
    if (jobError || !job) {
      console.error('[BulkProcessor] Job not found:', jobId);
      return;
    }
    
    if (job.status !== 'running') {
      console.log(`[BulkProcessor] Job ${jobId} is not running (status: ${job.status})`);
      return;
    }
    
    const pacingSeconds = job.pacing_seconds || 10;
    const siteFilter = job.site_filter;
    const includeTts = job.include_tts;
    
    // Process bookings one by one
    while (true) {
      // Check job status (for pause/stop)
      const { data: currentJob } = await supabase
        .from('bulk_processing_jobs')
        .select('status')
        .eq('id', jobId)
        .single();
      
      if (!currentJob || currentJob.status === 'paused') {
        console.log(`[BulkProcessor] Job ${jobId} paused`);
        await updateJobProgress(supabase, jobId, { paused_at: new Date().toISOString() });
        return;
      }
      
      if (currentJob.status === 'stopped' || currentJob.status === 'failed') {
        console.log(`[BulkProcessor] Job ${jobId} stopped/failed`);
        return;
      }
      
      // Fetch next batch of pending records
      const pendingBookings = await getPendingBookings(supabase, siteFilter, 1);
      
      if (pendingBookings.length === 0) {
        console.log(`[BulkProcessor] No more pending bookings for job ${jobId}`);
        await updateJobProgress(supabase, jobId, {
          status: 'completed',
          completed_at: new Date().toISOString()
        });
        return;
      }
      
      const booking = pendingBookings[0];
      
      // Update current booking
      await updateJobProgress(supabase, jobId, {
        current_booking_id: booking.id
      });
      
      // Process the booking
      const result = await processBooking(
        supabase,
        booking,
        includeTts,
        supabaseUrl,
        supabaseServiceKey
      );
      
      // Update progress
      const { data: progressJob } = await supabase
        .from('bulk_processing_jobs')
        .select('processed_count, skipped_count')
        .eq('id', jobId)
        .single();
      
      if (result.success) {
        await updateJobProgress(supabase, jobId, {
          processed_count: (progressJob?.processed_count || 0) + 1
        });
      } else if (result.skipped) {
        await updateJobProgress(supabase, jobId, {
          skipped_count: (progressJob?.skipped_count || 0) + 1
        });
        await addJobError(supabase, jobId, {
          bookingId: booking.id,
          error: result.error || 'Unknown error',
          timestamp: new Date().toISOString(),
          retryable: false
        });
      } else {
        // Check for quota error - pause job
        if (result.error?.includes('402') || result.error?.includes('Quota')) {
          console.log(`[BulkProcessor] Quota error detected, pausing job ${jobId}`);
          await updateJobProgress(supabase, jobId, {
            status: 'paused',
            paused_at: new Date().toISOString()
          });
          await addJobError(supabase, jobId, {
            bookingId: booking.id,
            error: result.error || 'Quota exceeded',
            timestamp: new Date().toISOString(),
            retryable: true
          });
          return;
        }
        
        // Log other errors but continue
        await addJobError(supabase, jobId, {
          bookingId: booking.id,
          error: result.error || 'Unknown error',
          timestamp: new Date().toISOString(),
          retryable: true
        });
      }
      
      // Wait before processing next record
      console.log(`[BulkProcessor] Waiting ${pacingSeconds}s before next record...`);
      await new Promise(resolve => setTimeout(resolve, pacingSeconds * 1000));
    }
    
  } catch (error) {
    console.error('[BulkProcessor] Processing loop error:', error);
    await updateJobProgress(supabase, jobId, {
      status: 'failed',
      completed_at: new Date().toISOString()
    });
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { jobId, action = 'start' } = await req.json() as JobConfig;
    
    if (!jobId) {
      throw new Error('Missing jobId');
    }
    
    // Get current job
    const { data: job, error: jobError } = await supabase
      .from('bulk_processing_jobs')
      .select('*')
      .eq('id', jobId)
      .single();
    
    if (jobError || !job) {
      throw new Error('Job not found');
    }
    
    switch (action) {
      case 'start':
      case 'resume': {
        // Get filtered count based on site_filter
        let totalCount = 0;
        
        if (job.site_filter === 'vixicom_only') {
          // Count Vixicom records using the same join logic
          const { data: vixicomAgents } = await supabase
            .from('agents')
            .select('id, sites!inner(name)')
            .ilike('sites.name', '%vixicom%');
          
          const agentIds = (vixicomAgents || []).map((a: any) => a.id);
          
          if (agentIds.length > 0) {
            const { count } = await supabase
              .from('bookings')
              .select('id', { count: 'exact', head: true })
              .is('transcription_status', null)
              .not('kixie_link', 'is', null)
              .not('kixie_link', 'eq', '')
              .in('agent_id', agentIds);
            totalCount = count || 0;
          }
        } else if (job.site_filter === 'non_vixicom') {
          // Count non-Vixicom records
          const { data: vixicomAgents } = await supabase
            .from('agents')
            .select('id, sites!inner(name)')
            .ilike('sites.name', '%vixicom%');
          
          const vixicomAgentIds = (vixicomAgents || []).map((a: any) => a.id);
          
          // Get total pending, then subtract Vixicom count
          const { count: totalPending } = await supabase
            .from('bookings')
            .select('id', { count: 'exact', head: true })
            .is('transcription_status', null)
            .not('kixie_link', 'is', null)
            .not('kixie_link', 'eq', '');
          
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
          totalCount = (totalPending || 0) - vixicomCount;
        } else {
          // All records
          const { count } = await supabase
            .from('bookings')
            .select('id', { count: 'exact', head: true })
            .is('transcription_status', null)
            .not('kixie_link', 'is', null)
            .not('kixie_link', 'eq', '');
          totalCount = count || 0;
        }
        
        // Update job to running with CORRECT count
        await updateJobProgress(supabase, jobId, {
          status: 'running',
          started_at: job.started_at || new Date().toISOString(),
          total_records: totalCount,
          paused_at: null
        });
        
        // Start background processing
        EdgeRuntime.waitUntil(
          runProcessingLoop(supabase, jobId, supabaseUrl, supabaseServiceKey)
        );
        
        return new Response(
          JSON.stringify({
            success: true,
            message: action === 'start' ? 'Processing started' : 'Processing resumed',
            jobId,
            totalRecords: totalCount
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      case 'pause': {
        await updateJobProgress(supabase, jobId, {
          status: 'paused',
          paused_at: new Date().toISOString()
        });
        
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Processing paused',
            jobId
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      case 'stop': {
        await updateJobProgress(supabase, jobId, {
          status: 'stopped',
          completed_at: new Date().toISOString()
        });
        
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Processing stopped',
            jobId
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
  } catch (error) {
    console.error('[BulkProcessor] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
