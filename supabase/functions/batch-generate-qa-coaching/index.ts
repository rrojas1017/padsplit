import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { requireUser, corsHeaders, ADMINS } from "../_shared/auth.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireUser(req, ADMINS);
  if (!auth.ok) return auth.response;

  try {
    console.log('Starting batch QA coaching audio generation...');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: gateRows, error: gateErr } = await supabase.rpc('get_daily_coaching_gate');
    if (gateErr) {
      console.error('[CostGate] RPC failed, continuing (fail-open):', gateErr.message);
    } else {
      const gate: any = Array.isArray(gateRows) ? gateRows[0] : gateRows;
      if (gate?.is_blocked) {
        return new Response(
          JSON.stringify({ success: false, blocked: true, queued: 0, message: 'Daily cost gate active' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Find all transcriptions with QA scores but no QA coaching audio
    const { data: transcriptions, error: fetchError } = await supabase
      .from('booking_transcriptions')
      .select('booking_id, qa_scores')
      .not('qa_scores', 'is', null)
      .is('qa_coaching_audio_url', null)
      .is('qa_coaching_audio_generated_at', null)
      .limit(100); // Process max 100 at a time

    if (fetchError) {
      throw new Error(`Failed to fetch transcriptions: ${fetchError.message}`);
    }

    if (!transcriptions || transcriptions.length === 0) {
      console.log('No transcriptions need QA coaching audio generation');
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: 'No pending QA coaching audio to generate' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${transcriptions.length} transcriptions needing QA coaching audio`);

    // Process in background with pacing
    const processInBackground = async () => {
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < transcriptions.length; i++) {
        const transcription = transcriptions[i];
        
        try {
          console.log(`Processing ${i + 1}/${transcriptions.length}: booking ${transcription.booking_id}`);

          // Call the generate-qa-coaching-audio function
          const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-qa-coaching-audio`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ bookingId: transcription.booking_id }),
          });

          if (response.status === 429) {
            await response.text();
            console.log('[CostGate] Blocked mid-batch, stopping');
            break;
          }

          if (response.ok) {
            successCount++;
            console.log(`Successfully generated QA coaching for booking ${transcription.booking_id}`);
          } else {
            const errorText = await response.text();
            console.error(`Failed to generate QA coaching for booking ${transcription.booking_id}:`, errorText);
            failCount++;
          }
        } catch (error) {
          console.error(`Error processing booking ${transcription.booking_id}:`, error);
          failCount++;
        }

        // Pace the requests: 10 second delay between each to avoid rate limiting
        if (i < transcriptions.length - 1) {
          console.log('Waiting 10 seconds before next request...');
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      }

      console.log(`Batch QA coaching generation complete. Success: ${successCount}, Failed: ${failCount}`);
    };

    // Start processing in background
    EdgeRuntime.waitUntil(processInBackground());

    // Return immediately
    return new Response(
      JSON.stringify({
        success: true,
        queued: transcriptions.length,
        message: `Started generating QA coaching audio for ${transcriptions.length} bookings. Processing in background with 10-second pacing.`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in batch QA coaching generation:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
