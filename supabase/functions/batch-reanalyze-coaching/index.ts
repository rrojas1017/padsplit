import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting batch re-analyze coaching...');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if specific booking IDs were provided
    let bookingIds: string[] = [];
    try {
      const body = await req.json();
      if (body.bookingIds && Array.isArray(body.bookingIds)) {
        bookingIds = body.bookingIds;
        console.log(`Processing specific bookings: ${bookingIds.join(', ')}`);
      }
    } catch {
      // No body or invalid JSON - will query for all missing
    }

    let transcriptions;

    if (bookingIds.length > 0) {
      // Process specific bookings
      const { data, error } = await supabase
        .from('booking_transcriptions')
        .select('booking_id, call_transcription')
        .in('booking_id', bookingIds)
        .not('call_transcription', 'is', null);

      if (error) throw new Error(`Failed to fetch transcriptions: ${error.message}`);
      transcriptions = data;
    } else {
      // Find all transcriptions with transcription but no agent_feedback
      const { data, error } = await supabase
        .from('booking_transcriptions')
        .select('booking_id, call_transcription, agent_feedback')
        .not('call_transcription', 'is', null)
        .is('agent_feedback', null)
        .limit(100);

      if (error) throw new Error(`Failed to fetch transcriptions: ${error.message}`);
      transcriptions = data;
    }

    if (!transcriptions || transcriptions.length === 0) {
      console.log('No transcriptions need re-analysis');
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: 'No bookings need coaching re-analysis' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${transcriptions.length} transcriptions to re-analyze`);

    // Process in background with pacing
    const processInBackground = async () => {
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < transcriptions.length; i++) {
        const transcription = transcriptions[i];
        
        try {
          console.log(`Re-analyzing ${i + 1}/${transcriptions.length}: booking ${transcription.booking_id}`);

          // Call reanalyze-call function
          const response = await fetch(`${SUPABASE_URL}/functions/v1/reanalyze-call`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ bookingId: transcription.booking_id }),
          });

          if (response.ok) {
            console.log(`[STEP 1/4] ✓ Re-analyzed booking ${transcription.booking_id}`);
            
            // Step 2: Generate Jeff's coaching audio
            console.log(`[STEP 2/4] Generating Jeff coaching audio for ${transcription.booking_id}...`);
            const audioResponse = await fetch(`${SUPABASE_URL}/functions/v1/generate-coaching-audio`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ bookingId: transcription.booking_id }),
            });

            if (audioResponse.ok) {
              console.log(`[STEP 2/4] ✓ Jeff audio generated for ${transcription.booking_id}`);
            } else {
              const errorText = await audioResponse.text();
              console.error(`[STEP 2/4] ✗ Failed Jeff audio for ${transcription.booking_id}:`, errorText);
            }

            // Step 3: Generate QA scores
            console.log(`[STEP 3/4] Generating QA scores for ${transcription.booking_id}...`);
            const qaResponse = await fetch(`${SUPABASE_URL}/functions/v1/generate-qa-scores`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ bookingId: transcription.booking_id }),
            });

            if (qaResponse.ok) {
              console.log(`[STEP 3/4] ✓ QA scores generated for ${transcription.booking_id}`);
              
              // Step 4: Generate Katty's QA coaching audio
              console.log(`[STEP 4/4] Generating Katty coaching audio for ${transcription.booking_id}...`);
              const kattyResponse = await fetch(`${SUPABASE_URL}/functions/v1/generate-qa-coaching-audio`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ bookingId: transcription.booking_id }),
              });

              if (kattyResponse.ok) {
                console.log(`[STEP 4/4] ✓ Katty audio generated for ${transcription.booking_id}`);
              } else {
                const errorText = await kattyResponse.text();
                console.error(`[STEP 4/4] ✗ Failed Katty audio for ${transcription.booking_id}:`, errorText);
              }
            } else {
              const errorText = await qaResponse.text();
              console.error(`[STEP 3/4] ✗ Failed QA scores for ${transcription.booking_id}:`, errorText);
            }

            successCount++;
            console.log(`✓ COMPLETE: All 4 steps processed for ${transcription.booking_id}`);
          } else {
            const errorText = await response.text();
            console.error(`[STEP 1/4] ✗ Failed re-analyze for ${transcription.booking_id}:`, errorText);
            failCount++;
          }
        } catch (error) {
          console.error(`ERROR processing booking ${transcription.booking_id}:`, error);
          failCount++;
        }

        // Pace the requests: 10 second delay between each to avoid rate limiting
        if (i < transcriptions.length - 1) {
          console.log('Waiting 10 seconds before next request...');
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      }

      console.log(`Batch re-analysis complete. Success: ${successCount}, Failed: ${failCount}`);
    };

    // Start processing in background
    EdgeRuntime.waitUntil(processInBackground());

    // Return immediately
    return new Response(
      JSON.stringify({
        success: true,
        queued: transcriptions.length,
        bookingIds: transcriptions.map(t => t.booking_id),
        message: `Started re-analyzing ${transcriptions.length} bookings. Processing in background with 10-second pacing. Will also generate coaching audio after each successful re-analysis.`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in batch re-analyze coaching:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
