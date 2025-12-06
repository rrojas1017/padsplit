import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting batch QA coaching audio generation...');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find all transcriptions with QA scores but no QA coaching audio
    const { data: transcriptions, error: fetchError } = await supabase
      .from('booking_transcriptions')
      .select('booking_id, qa_scores')
      .not('qa_scores', 'is', null)
      .is('qa_coaching_audio_url', null)
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

        // Pace the requests: 3 second delay between each to avoid rate limiting
        if (i < transcriptions.length - 1) {
          console.log('Waiting 3 seconds before next request...');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }

      console.log(`Batch QA coaching generation complete. Success: ${successCount}, Failed: ${failCount}`);
    };

    // Start processing in background
    processInBackground();

    // Return immediately
    return new Response(
      JSON.stringify({
        success: true,
        queued: transcriptions.length,
        message: `Started generating QA coaching audio for ${transcriptions.length} bookings. Processing in background with 3-second pacing.`
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
