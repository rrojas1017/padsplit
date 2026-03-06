import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 5;
const PARALLEL_SIZE = 3;

Deno.serve(async (req) => {
// ... keep existing code
    // Process records in parallel chunks of PARALLEL_SIZE
    let processed = 0;
    let failed = 0;

    for (let i = 0; i < toProcess.length; i += PARALLEL_SIZE) {
      const chunk = toProcess.slice(i, i + PARALLEL_SIZE);
      console.log(`[Backfill] Processing chunk ${Math.floor(i / PARALLEL_SIZE) + 1}: ${chunk.map((r: any) => r.id).join(', ')}`);

      const results = await Promise.allSettled(
        chunk.map(async (record: any) => {
          const response = await fetch(`${supabaseUrl}/functions/v1/process-research-record`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ bookingId: record.id }),
          });

          if (response.ok) {
            const body = await response.json();
            console.log(`[Backfill] Successfully processed ${record.id}`);
            return { id: record.id, success: true };
          } else {
            const errorText = await response.text();
            console.error(`[Backfill] Failed ${record.id}: ${response.status} - ${errorText}`);
            throw new Error(errorText);
          }
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          processed++;
        } else {
          failed++;
        }
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
