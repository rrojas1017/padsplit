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

interface FailedBooking {
  id: string;
  kixie_link: string;
  member_name: string;
  booking_date: string;
  transcription_status: string | null;
  transcription_error_message: string | null;
  import_batch_id: string | null;
  agents?: {
    id: string;
    name: string;
    sites?: { name: string } | null;
  } | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[BATCH-RETRY] Starting batch retry transcriptions scan...');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse request body
    let dryRun = false;
    let dateFrom: string | null = null;
    let dateTo: string | null = null;
    let limit = 50;
    let specificBookingIds: string[] | null = null;

    try {
      const body = await req.json();
      dryRun = body.dryRun === true;
      dateFrom = body.dateFrom || null;
      dateTo = body.dateTo || null;
      limit = body.limit || 50;
      specificBookingIds = body.bookingIds || null;
      console.log(`[BATCH-RETRY] Options: dryRun=${dryRun}, dateFrom=${dateFrom}, dateTo=${dateTo}, limit=${limit}, specificIds=${specificBookingIds?.length || 0}`);
    } catch {
      // No body or invalid JSON
    }

    // If specific booking IDs provided, process those directly (for re-transcription of existing transcripts)
    if (specificBookingIds && specificBookingIds.length > 0) {
      console.log(`[BATCH-RETRY] Processing ${specificBookingIds.length} specific booking IDs`);
      
      // Fetch the bookings with site info for TTS decision
      const { data: targetBookings, error: fetchError } = await supabase
        .from('bookings')
        .select(`
          id, kixie_link, member_name, booking_date, import_batch_id,
          agents!inner(id, name, sites(name))
        `)
        .in('id', specificBookingIds)
        .not('kixie_link', 'is', null);

      if (fetchError) {
        throw new Error(`Failed to fetch bookings: ${fetchError.message}`);
      }

      if (!targetBookings || targetBookings.length === 0) {
        return new Response(
          JSON.stringify({ success: false, message: 'No valid bookings found with kixie_link' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[BATCH-RETRY] Found ${targetBookings.length} bookings to re-transcribe`);

      if (dryRun) {
        return new Response(
          JSON.stringify({
            success: true,
            dryRun: true,
            found: targetBookings.length,
            bookings: targetBookings.map(b => ({
              id: b.id,
              member_name: b.member_name,
              booking_date: b.booking_date
            }))
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Process in background
      const processSpecificBookings = async () => {
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < targetBookings.length; i++) {
          const booking = targetBookings[i];
          console.log(`[BATCH-RETRY] Processing ${i + 1}/${targetBookings.length}: ${booking.id} (${booking.member_name})`);

          try {
            // Delete existing transcription record to allow fresh re-transcription
            await supabase
              .from('booking_transcriptions')
              .delete()
              .eq('booking_id', booking.id);

            // Reset status to pending
            await supabase
              .from('bookings')
              .update({ 
                transcription_status: 'pending',
                transcription_error_message: null 
              })
              .eq('id', booking.id);

            // Determine if TTS should be skipped (imported records or non-Vixicom sites)
            const isImported = !!booking.import_batch_id;
            const siteName = booking.agents?.sites?.name || '';
            const isVixicom = siteName.toLowerCase().includes('vixicom');
            const skipTts = true; // Batch-retry jobs do NOT generate coaching audio
            
            console.log(`[BATCH-RETRY] Booking ${booking.id}: isImported=${isImported}, site="${siteName}", skipTts=${skipTts}`);

            // Trigger transcription
            const response = await fetch(`${SUPABASE_URL}/functions/v1/transcribe-call`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ 
                bookingId: booking.id, 
                kixieUrl: booking.kixie_link,
                skipTts
              }),
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error(`[BATCH-RETRY] FAILED transcribe-call for ${booking.id}: ${errorText}`);
              failCount++;
            } else {
              console.log(`[BATCH-RETRY] ✓ Transcription triggered for ${booking.id}`);
              successCount++;
            }

          } catch (error) {
            console.error(`[BATCH-RETRY] ERROR processing ${booking.id}:`, error);
            failCount++;
          }

          // Pace requests: 2 seconds between to avoid hammering
          if (i < targetBookings.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }

        console.log(`[BATCH-RETRY] ===== COMPLETE =====`);
        console.log(`[BATCH-RETRY] Triggered: ${successCount}, Failed to trigger: ${failCount}`);
      };

      // Start processing in background
      EdgeRuntime.waitUntil(processSpecificBookings());

      return new Response(
        JSON.stringify({
          success: true,
          queued: targetBookings.length,
          bookings: targetBookings.map(b => ({
            id: b.id,
            member_name: b.member_name,
            booking_date: b.booking_date
          })),
          message: `Started re-transcription for ${targetBookings.length} bookings. Processing in background with 30-second pacing. ETA: ~${Math.ceil(targetBookings.length * 0.5)} minutes.`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find bookings that:
    // 1. Have a kixie_link
    // 2. Have transcription_status = 'failed' OR null OR 'pending'
    // 3. Do NOT have a booking_transcriptions record (never successfully transcribed)
    let query = supabase
      .from('bookings')
      .select(`
        id,
        kixie_link,
        member_name,
        booking_date,
        transcription_status,
        transcription_error_message,
        import_batch_id,
        agents!inner(id, name, sites(name))
      `)
      .not('kixie_link', 'is', null)
      .or('transcription_status.is.null,transcription_status.in.(failed,pending,queued)')
      .order('booking_date', { ascending: false })
      .limit(limit);

    if (dateFrom) {
      query = query.gte('booking_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('booking_date', dateTo);
    }

    const { data: potentialBookings, error: bookingsError } = await query;

    if (bookingsError) {
      throw new Error(`Failed to fetch bookings: ${bookingsError.message}`);
    }

    if (!potentialBookings || potentialBookings.length === 0) {
      console.log('[BATCH-RETRY] No failed bookings found');
      return new Response(
        JSON.stringify({ 
          success: true, 
          found: 0, 
          message: 'No failed transcriptions found' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[BATCH-RETRY] Found ${potentialBookings.length} potential bookings to check`);

    // Filter to only bookings WITHOUT a booking_transcriptions record
    const bookingIds = potentialBookings.map(b => b.id);
    const { data: existingTranscriptions, error: transError } = await supabase
      .from('booking_transcriptions')
      .select('booking_id')
      .in('booking_id', bookingIds);

    if (transError) {
      console.error('[BATCH-RETRY] Error checking transcriptions:', transError);
    }

    const transcribedIds = new Set((existingTranscriptions || []).map(t => t.booking_id));
    
    // Filter: no transcription record, OR queued for more than 10 minutes (stuck)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const failedBookings = (potentialBookings as FailedBooking[]).filter(b => {
      if (transcribedIds.has(b.id)) return false;
      // For queued records, only include if they've been stuck for >10 minutes
      if (b.transcription_status === 'queued') {
        return (b.booking_date || '') < tenMinutesAgo;
      }
      return true;
    });

    console.log(`[BATCH-RETRY] ${failedBookings.length} bookings need re-transcription (no transcription record)`);

    if (failedBookings.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          found: 0, 
          message: 'All failed bookings already have transcription attempts. Use fix-incomplete-bookings for those.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (dryRun) {
      return new Response(
        JSON.stringify({
          success: true,
          dryRun: true,
          found: failedBookings.length,
          bookings: failedBookings.map(b => ({
            id: b.id,
            member_name: b.member_name,
            booking_date: b.booking_date,
            transcription_status: b.transcription_status,
            error_message: b.transcription_error_message
          }))
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process in background
    const processInBackground = async () => {
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < failedBookings.length; i++) {
        const booking = failedBookings[i];
        console.log(`[BATCH-RETRY] Processing ${i + 1}/${failedBookings.length}: ${booking.id} (${booking.member_name})`);

        try {
          // Reset status to pending
          await supabase
            .from('bookings')
            .update({ 
              transcription_status: 'pending',
              transcription_error_message: null 
            })
            .eq('id', booking.id);

          // Determine if TTS should be skipped (imported records or non-Vixicom sites)
          const isImported = !!booking.import_batch_id;
          const siteName = booking.agents?.sites?.name || '';
          const isVixicom = siteName.toLowerCase().includes('vixicom');
          const skipTts = true; // Batch-retry jobs do NOT generate coaching audio
          
          console.log(`[BATCH-RETRY] Booking ${booking.id}: isImported=${isImported}, site="${siteName}", skipTts=${skipTts}`);

          // Trigger transcription
          const response = await fetch(`${SUPABASE_URL}/functions/v1/transcribe-call`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              bookingId: booking.id, 
              kixieUrl: booking.kixie_link,
              skipTts
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[BATCH-RETRY] FAILED transcribe-call for ${booking.id}: ${errorText}`);
            failCount++;
          } else {
            console.log(`[BATCH-RETRY] ✓ Transcription triggered for ${booking.id}`);
            successCount++;
          }

        } catch (error) {
          console.error(`[BATCH-RETRY] ERROR processing ${booking.id}:`, error);
          failCount++;
        }

        // Pace requests: 30 seconds between to avoid rate limiting
        if (i < failedBookings.length - 1) {
          console.log('[BATCH-RETRY] Waiting 30 seconds before next booking...');
          await new Promise(resolve => setTimeout(resolve, 30000));
        }
      }

      console.log(`[BATCH-RETRY] ===== COMPLETE =====`);
      console.log(`[BATCH-RETRY] Triggered: ${successCount}, Failed to trigger: ${failCount}`);
    };

    // Start processing in background
    EdgeRuntime.waitUntil(processInBackground());

    // Return immediately
    return new Response(
      JSON.stringify({
        success: true,
        queued: failedBookings.length,
        bookings: failedBookings.map(b => ({
          id: b.id,
          member_name: b.member_name,
          booking_date: b.booking_date
        })),
        message: `Started re-transcription for ${failedBookings.length} bookings. Processing in background with 30-second pacing.`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[BATCH-RETRY] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
