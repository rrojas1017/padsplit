import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 5;
const PARALLEL_SIZE = 3;

declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
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
    const action = body.action || 'start';

    if (dryRun) {
      // Count unprocessed with same criteria used in processing
      const remaining = await countRemaining(supabase);
      return new Response(
        JSON.stringify({ success: true, totalUnprocessed: remaining }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Backfill] Invoked with action="${action}"`);

    // Run processing in background so the HTTP response returns immediately
    EdgeRuntime.waitUntil(runOneBatch(supabaseUrl, supabaseServiceKey, supabase));

    return new Response(
      JSON.stringify({
        success: true,
        message: action === 'continue'
          ? 'Continuation batch started in background'
          : 'Processing started in background',
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

// ── helpers ──

async function countRemaining(supabase: any): Promise<number> {
  // Count research bookings with non-empty transcripts that haven't been processed
  const { count, error } = await supabase
    .from('bookings')
    .select('id, booking_transcriptions!inner(id)', { count: 'exact', head: true })
    .eq('record_type', 'research')
    .eq('has_valid_conversation', true)
    .not('booking_transcriptions.call_transcription', 'is', null)
    .neq('booking_transcriptions.call_transcription', '')
    .or('research_processing_status.is.null,research_processing_status.eq.failed', { referencedTable: 'booking_transcriptions' });

  if (error) {
    console.error('[Backfill] countRemaining error:', error.message);
    return 0;
  }
  return count || 0;
}

async function runOneBatch(supabaseUrl: string, supabaseServiceKey: string, supabase: any) {
  try {
    // 1) Auto-reset records stuck in 'processing' for >15 minutes
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

    // 2) Fetch candidates – over-fetch to compensate for any edge cases
    const fetchLimit = BATCH_SIZE * 3;
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
      .neq('booking_transcriptions.call_transcription', '')
      .or('research_processing_status.is.null,research_processing_status.eq.failed', { referencedTable: 'booking_transcriptions' })
      .limit(fetchLimit);

    if (fetchError) {
      console.error(`[Backfill] Failed to fetch candidates: ${fetchError.message}`);
      return;
    }

    // Defensive in-memory filter + trim check, then take BATCH_SIZE
    const toProcess = (unprocessed || [])
      .filter((r: any) => {
        const t = Array.isArray(r.booking_transcriptions) ? r.booking_transcriptions[0] : r.booking_transcriptions;
        return t?.call_transcription?.trim()?.length > 0 &&
          (!t?.research_processing_status || t?.research_processing_status === 'failed');
      })
      .slice(0, BATCH_SIZE);

    console.log(`[Backfill] Found ${unprocessed?.length || 0} candidates / ${toProcess.length} processable`);

    if (toProcess.length === 0) {
      console.log('[Backfill] No processable records remaining. Done.');
      return;
    }

    // 3) Process in parallel chunks of PARALLEL_SIZE
    let processed = 0;
    let failed = 0;

    for (let i = 0; i < toProcess.length; i += PARALLEL_SIZE) {
      const chunk = toProcess.slice(i, i + PARALLEL_SIZE);
      console.log(`[Backfill] Processing chunk: ${chunk.map((r: any) => r.id).join(', ')}`);

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
            console.log(`[Backfill] ✓ Processed ${record.id}`);
            return { id: record.id, success: true };
          } else {
            const errorText = await response.text();
            console.error(`[Backfill] ✗ Failed ${record.id}: ${response.status} - ${errorText}`);
            throw new Error(errorText);
          }
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled') processed++;
        else failed++;
      }
    }

    // 4) Count remaining and decide whether to continue
    const remainingCount = await countRemaining(supabase);
    console.log(`[Backfill] Processed ${processed}, failed ${failed}, remaining ${remainingCount}`);

    if (remainingCount > 0) {
      console.log(`[Backfill] Self-retriggering for ${remainingCount} remaining records...`);
      await selfRetrigger(supabaseUrl, supabaseServiceKey);
    } else {
      console.log('[Backfill] All records processed. Pipeline complete.');
    }

  } catch (error) {
    console.error('[Backfill] runOneBatch error:', error instanceof Error ? error.message : error);
  }
}

async function selfRetrigger(supabaseUrl: string, supabaseServiceKey: string, attempt = 1) {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/batch-process-research-records`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'continue' }),
    });

    if (response.ok) {
      console.log('[Backfill] Self-retrigger success');
    } else {
      const text = await response.text();
      console.error(`[Backfill] Self-retrigger failed (${response.status}): ${text}`);
      if (attempt < 2) {
        console.log('[Backfill] Retrying self-retrigger in 3s...');
        await new Promise(r => setTimeout(r, 3000));
        await selfRetrigger(supabaseUrl, supabaseServiceKey, attempt + 1);
      }
    }
  } catch (error) {
    console.error('[Backfill] Self-retrigger network error:', error);
    if (attempt < 2) {
      console.log('[Backfill] Retrying self-retrigger in 3s...');
      await new Promise(r => setTimeout(r, 3000));
      await selfRetrigger(supabaseUrl, supabaseServiceKey, attempt + 1);
    }
  }
}
