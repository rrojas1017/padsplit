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
    console.log('Starting batch coaching audio generation (Jeff)...');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find all transcriptions with agent_feedback but no coaching audio
    const { data: transcriptions, error: fetchError } = await supabase
      .from('booking_transcriptions')
      .select('booking_id, agent_feedback')
      .not('agent_feedback', 'is', null)
      .is('coaching_audio_url', null)
      .limit(100);

    if (fetchError) {
      throw new Error(`Failed to fetch transcriptions: ${fetchError.message}`);
    }

    if (!transcriptions || transcriptions.length === 0) {
      console.log('No transcriptions need coaching audio generation');
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: 'No pending coaching audio to generate' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${transcriptions.length} transcriptions needing coaching audio (Jeff)`);

    // Process in background with pacing
    const processInBackground = async () => {
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < transcriptions.length; i++) {
        const transcription = transcriptions[i];
        
        try {
          console.log(`Processing ${i + 1}/${transcriptions.length}: booking ${transcription.booking_id}`);

          const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-coaching-audio`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ bookingId: transcription.booking_id }),
          });

          if (response.ok) {
            successCount++;
            console.log(`Successfully generated coaching audio for booking ${transcription.booking_id}`);
          } else {
            const errorText = await response.text();
            console.error(`Failed to generate coaching audio for booking ${transcription.booking_id}:`, errorText);
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

      console.log(`Batch coaching audio generation complete. Success: ${successCount}, Failed: ${failCount}`);
    };

    // Start processing in background
    EdgeRuntime.waitUntil(processInBackground());

    // Return immediately
    return new Response(
      JSON.stringify({
        success: true,
        queued: transcriptions.length,
        message: `Started generating coaching audio (Jeff) for ${transcriptions.length} bookings. Processing in background with 10-second pacing.`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in batch coaching audio generation:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
