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
    const dryRun = body.dryRun === true;

    // First get research booking IDs
    const { data: researchBookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('id')
      .eq('record_type', 'research');

    if (bookingsError) throw bookingsError;

    const bookingIds = (researchBookings || []).map((b: any) => b.id);

    if (bookingIds.length === 0) {
      return new Response(JSON.stringify({ count: 0, reset_count: 0, message: 'No research bookings found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (dryRun) {
      const { count, error } = await supabase
        .from('booking_transcriptions')
        .select('id', { count: 'exact', head: true })
        .eq('research_processing_status', 'completed')
        .in('booking_id', bookingIds);

      if (error) throw error;
      return new Response(JSON.stringify({ count: count || 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get IDs to reset
    const { data: toReset, error: listError } = await supabase
      .from('booking_transcriptions')
      .select('id')
      .eq('research_processing_status', 'completed')
      .in('booking_id', bookingIds);

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
