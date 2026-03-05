import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 5;

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

    // Auto-reset records stuck in 'processing' for >15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: resetData } = await supabase
      .from('booking_transcriptions')
      .update({ research_processing_status: null })
      .eq('research_processing_status', 'processing')
      .lt('updated_at', fifteenMinutesAgo)
      .select('id');
    
    if (resetData && resetData.length > 0) {
      console.log(`[Backfill] Auto-reset ${resetData.length} stale processing records`);
    }

    // Find unprocessed research records with transcripts
    const { data: unprocessed, error: fetchError } = await supabase
      .from('bookings')
      .select(`
        id,
        booking_transcriptions!inner (
          call_transcription,
          research_processing_status
        )
      `)
      .eq('record_type', 'research')
      .eq('has_valid_conversation', true)
      .not('booking_transcriptions.call_transcription', 'is', null)
      .or('research_processing_status.is.null,research_processing_status.eq.failed', { referencedTable: 'booking_transcriptions' })
      .limit(dryRun ? 1000 : BATCH_SIZE);

    if (fetchError) {
      throw new Error(`Failed to fetch unprocessed records: ${fetchError.message}`);
    }

    // Filter to only records that truly need processing
    const toProcess = (unprocessed || []).filter((r: any) => {
      const t = Array.isArray(r.booking_transcriptions) ? r.booking_transcriptions[0] : r.booking_transcriptions;
      return t?.call_transcription && (!t?.research_processing_status || t?.research_processing_status === 'failed');
    });

    if (dryRun) {
      return new Response(
        JSON.stringify({ success: true, totalUnprocessed: toProcess.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Backfill] Found ${toProcess.length} unprocessed research records`);

    if (toProcess.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, remaining: 0, message: 'All records processed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process each record by calling process-research-record
    let processed = 0;
    let failed = 0;

    for (const record of toProcess) {
      try {
        console.log(`[Backfill] Processing ${record.id} (${processed + 1}/${toProcess.length})`);

        const response = await fetch(`${supabaseUrl}/functions/v1/process-research-record`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ bookingId: record.id }),
        });

        if (response.ok) {
          processed++;
          console.log(`[Backfill] Successfully processed ${record.id}`);
        } else {
          failed++;
          const errorText = await response.text();
          console.error(`[Backfill] Failed ${record.id}: ${response.status} - ${errorText}`);
        }

        // Brief pause between records to avoid rate limiting
        await new Promise(r => setTimeout(r, 2000));
      } catch (error) {
        failed++;
        console.error(`[Backfill] Error processing ${record.id}:`, error);
      }
    }

    // Check if there are more to process
    const { count: remainingCount } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('record_type', 'research')
      .not('booking_transcriptions.call_transcription', 'is', null);

    // Self-retrigger if there are more records
    const hasMore = toProcess.length === BATCH_SIZE;
    if (hasMore) {
      console.log(`[Backfill] More records to process, self-retriggering...`);
      try {
        await fetch(`${supabaseUrl}/functions/v1/batch-process-research-records`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
      } catch (error) {
        console.error(`[Backfill] Failed to self-retrigger:`, error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        failed,
        hasMore,
        message: hasMore ? 'Batch complete, retriggering for remaining records' : 'All records processed',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Backfill] Error:`, errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
