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

interface IncompleteBooking {
  booking_id: string;
  call_transcription: string | null;
  agent_feedback: unknown;
  qa_scores: unknown;
  coaching_audio_url: string | null;
  qa_coaching_audio_url: string | null;
}

interface ProcessingStep {
  name: string;
  missing: boolean;
  dependency?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[FIX-INCOMPLETE] Starting incomplete bookings scan...');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if specific booking IDs were provided
    let bookingIds: string[] = [];
    let dryRun = false;
    try {
      const body = await req.json();
      if (body.bookingIds && Array.isArray(body.bookingIds)) {
        bookingIds = body.bookingIds;
        console.log(`[FIX-INCOMPLETE] Processing specific bookings: ${bookingIds.join(', ')}`);
      }
      if (body.dryRun === true) {
        dryRun = true;
        console.log('[FIX-INCOMPLETE] DRY RUN MODE - will only report, not fix');
      }
    } catch {
      // No body or invalid JSON - will scan all
    }

    // Query for bookings with transcriptions
    let query = supabase
      .from('booking_transcriptions')
      .select('booking_id, call_transcription, agent_feedback, qa_scores, coaching_audio_url, qa_coaching_audio_url')
      .not('call_transcription', 'is', null);

    if (bookingIds.length > 0) {
      query = query.in('booking_id', bookingIds);
    } else {
      query = query.limit(100);
    }

    const { data: transcriptions, error } = await query;

    if (error) throw new Error(`Failed to fetch transcriptions: ${error.message}`);

    if (!transcriptions || transcriptions.length === 0) {
      console.log('[FIX-INCOMPLETE] No transcriptions found to check');
      return new Response(
        JSON.stringify({ success: true, checked: 0, incomplete: 0, message: 'No transcriptions found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[FIX-INCOMPLETE] Checking ${transcriptions.length} transcriptions...`);

    // Analyze each booking for missing steps
    const incompleteBookings: Array<{
      booking_id: string;
      missingSteps: string[];
      details: ProcessingStep[];
    }> = [];

    for (const t of transcriptions as IncompleteBooking[]) {
      const steps: ProcessingStep[] = [
        { 
          name: 'transcription', 
          missing: !t.call_transcription 
        },
        { 
          name: 'jeff_feedback', 
          missing: !t.agent_feedback,
          dependency: 'transcription'
        },
        { 
          name: 'jeff_audio', 
          missing: !t.coaching_audio_url,
          dependency: 'jeff_feedback'
        },
        { 
          name: 'qa_scores', 
          missing: !t.qa_scores,
          dependency: 'transcription'
        },
        { 
          name: 'katty_audio', 
          missing: !t.qa_coaching_audio_url,
          dependency: 'qa_scores'
        },
      ];

      const missingSteps = steps.filter(s => s.missing).map(s => s.name);
      
      if (missingSteps.length > 0) {
        incompleteBookings.push({
          booking_id: t.booking_id,
          missingSteps,
          details: steps
        });
        console.log(`[FIX-INCOMPLETE] Booking ${t.booking_id} missing: ${missingSteps.join(', ')}`);
      }
    }

    if (incompleteBookings.length === 0) {
      console.log('[FIX-INCOMPLETE] All bookings are complete!');
      return new Response(
        JSON.stringify({ 
          success: true, 
          checked: transcriptions.length, 
          incomplete: 0, 
          message: 'All bookings are complete' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[FIX-INCOMPLETE] Found ${incompleteBookings.length} incomplete bookings`);

    if (dryRun) {
      return new Response(
        JSON.stringify({
          success: true,
          dryRun: true,
          checked: transcriptions.length,
          incomplete: incompleteBookings.length,
          bookings: incompleteBookings
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process in background
    const processInBackground = async () => {
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < incompleteBookings.length; i++) {
        const booking = incompleteBookings[i];
        console.log(`[FIX-INCOMPLETE] Processing ${i + 1}/${incompleteBookings.length}: ${booking.booking_id}`);
        console.log(`[FIX-INCOMPLETE] Missing steps: ${booking.missingSteps.join(', ')}`);

        try {
          // Determine what needs to run based on dependencies
          const needsJeffFeedback = booking.missingSteps.includes('jeff_feedback');
          const needsJeffAudio = booking.missingSteps.includes('jeff_audio');
          const needsQAScores = booking.missingSteps.includes('qa_scores');
          const needsKattyAudio = booking.missingSteps.includes('katty_audio');

          // Step 1: If missing Jeff feedback, reanalyze
          if (needsJeffFeedback) {
            console.log(`[FIX-INCOMPLETE] Step 1: Re-analyzing for Jeff feedback...`);
            const response = await fetch(`${SUPABASE_URL}/functions/v1/reanalyze-call`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ bookingId: booking.booking_id }),
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error(`[FIX-INCOMPLETE] FAILED reanalyze-call: ${errorText}`);
              failCount++;
              continue; // Skip this booking
            }
            console.log(`[FIX-INCOMPLETE] ✓ Jeff feedback generated`);
          }

          // Step 2: If missing Jeff audio (and now have feedback), generate audio
          if (needsJeffFeedback || needsJeffAudio) {
            console.log(`[FIX-INCOMPLETE] Step 2: Generating Jeff coaching audio...`);
            const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-coaching-audio`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ bookingId: booking.booking_id }),
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error(`[FIX-INCOMPLETE] FAILED generate-coaching-audio: ${errorText}`);
              // Continue anyway to try QA pipeline
            } else {
              console.log(`[FIX-INCOMPLETE] ✓ Jeff audio generated`);
            }
          }

          // Step 3: If missing QA scores, generate them
          if (needsQAScores) {
            console.log(`[FIX-INCOMPLETE] Step 3: Generating QA scores...`);
            const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-qa-scores`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ bookingId: booking.booking_id }),
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error(`[FIX-INCOMPLETE] FAILED generate-qa-scores: ${errorText}`);
              // Continue anyway
            } else {
              console.log(`[FIX-INCOMPLETE] ✓ QA scores generated`);
            }
          }

          // Step 4: If missing Katty audio (and now have QA scores), generate audio
          if (needsQAScores || needsKattyAudio) {
            console.log(`[FIX-INCOMPLETE] Step 4: Generating Katty coaching audio...`);
            const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-qa-coaching-audio`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ bookingId: booking.booking_id }),
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error(`[FIX-INCOMPLETE] FAILED generate-qa-coaching-audio: ${errorText}`);
            } else {
              console.log(`[FIX-INCOMPLETE] ✓ Katty audio generated`);
            }
          }

          successCount++;
          console.log(`[FIX-INCOMPLETE] ✓ Completed processing booking ${booking.booking_id}`);

        } catch (error) {
          console.error(`[FIX-INCOMPLETE] ERROR processing ${booking.booking_id}:`, error);
          failCount++;
        }

        // Pace requests: 15 seconds between bookings to avoid rate limiting
        if (i < incompleteBookings.length - 1) {
          console.log('[FIX-INCOMPLETE] Waiting 15 seconds before next booking...');
          await new Promise(resolve => setTimeout(resolve, 15000));
        }
      }

      console.log(`[FIX-INCOMPLETE] ===== COMPLETE =====`);
      console.log(`[FIX-INCOMPLETE] Success: ${successCount}, Failed: ${failCount}`);
    };

    // Start processing in background
    EdgeRuntime.waitUntil(processInBackground());

    // Return immediately
    return new Response(
      JSON.stringify({
        success: true,
        queued: incompleteBookings.length,
        bookings: incompleteBookings.map(b => ({
          booking_id: b.booking_id,
          missingSteps: b.missingSteps
        })),
        message: `Started fixing ${incompleteBookings.length} incomplete bookings. Processing in background with 15-second pacing.`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[FIX-INCOMPLETE] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
