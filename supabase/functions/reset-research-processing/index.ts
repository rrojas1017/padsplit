import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const campaignId = body.campaignId || null;
    const dryRun = body.dryRun === true;

    // Find all booking_transcriptions that have been processed, linked to research bookings
    let query = supabase
      .from('booking_transcriptions')
      .select('id, booking_id, bookings!inner(id, record_type, campaign_id)', { count: 'exact', head: dryRun })
      .eq('research_processing_status', 'completed')
      .eq('bookings.record_type', 'research');

    if (campaignId) {
      // Filter by campaign via booking's research_call -> campaign
      // Since bookings don't have campaign_id directly, we skip campaign filter for now
      // unless the caller passes booking IDs
    }

    if (dryRun) {
      const { count, error } = await query;
      if (error) throw error;
      return new Response(JSON.stringify({ count: count || 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get IDs to reset
    const { data: records, error: fetchError } = await query.select('id');
    
    // Re-query without head mode to get actual IDs
    const { data: toReset, error: listError } = await supabase
      .from('booking_transcriptions')
      .select('id, bookings!inner(id, record_type)')
      .eq('research_processing_status', 'completed')
      .eq('bookings.record_type', 'research');

    if (listError) throw listError;

    const ids = (toReset || []).map((r: any) => r.id);

    if (ids.length === 0) {
      return new Response(JSON.stringify({ reset_count: 0, message: 'No records to reset' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Bulk reset in chunks of 500
    let resetCount = 0;
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      const { error: updateError } = await supabase
        .from('booking_transcriptions')
        .update({
          research_processing_status: null,
          research_extraction: null,
          research_classification: null,
          research_processed_at: null,
          research_human_review: false,
        })
        .in('id', chunk);

      if (updateError) throw updateError;
      resetCount += chunk.length;
    }

    // Auto-trigger batch processing
    const { error: invokeError } = await supabase.functions.invoke('batch-process-research-records', {
      body: {},
    });

    if (invokeError) {
      console.error('Failed to auto-trigger batch processing:', invokeError);
    }

    return new Response(JSON.stringify({
      reset_count: resetCount,
      message: `Reset ${resetCount} records. Batch processing started.`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in reset-research-processing:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
