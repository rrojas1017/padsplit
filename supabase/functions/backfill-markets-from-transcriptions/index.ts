import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessingResult {
  bookingId: string;
  success: boolean;
  city?: string | null;
  state?: string | null;
  error?: string;
}

// Extract market from transcription data using AI
async function extractMarketFromTranscription(
  callSummary: string | null,
  propertyAddress: string | null,
  lovableApiKey: string
): Promise<{ city: string | null; state: string | null }> {
  if (!callSummary && !propertyAddress) {
    return { city: null, state: null };
  }

  const prompt = `Extract the city and US state from this PadSplit call information.

CONTEXT: PadSplit operates in these major markets: Atlanta GA, Houston TX, Dallas TX, Tampa FL, Charlotte NC, Raleigh NC, Phoenix AZ, Las Vegas NV, Denver CO, Nashville TN, Birmingham AL, Memphis TN, Jacksonville FL, Orlando FL, Miami FL, San Antonio TX, Fort Worth TX, Austin TX, Lawrenceville GA, Stone Mountain GA, Decatur GA, Marietta GA, Smyrna GA, Sandy Springs GA, Duluth GA, Alpharetta GA, Roswell GA, Johns Creek GA.

CALL SUMMARY:
${callSummary || 'Not available'}

PROPERTY ADDRESS MENTIONED:
${propertyAddress || 'Not specified'}

INSTRUCTIONS:
1. Look for city names mentioned in either the summary or property address
2. Match to known PadSplit markets when possible
3. For Georgia suburbs/cities, still extract the specific city name
4. State should be the 2-letter abbreviation

Return ONLY a JSON object (no markdown, no explanation):
{
  "city": "city name or null if not found",
  "state": "two-letter state code or null if not found"
}`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite', // Fast and cheap
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      console.error('[Backfill] AI request failed:', response.status);
      return { city: null, state: null };
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';
    
    // Parse JSON response
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```json')) cleanedContent = cleanedContent.slice(7);
    if (cleanedContent.startsWith('```')) cleanedContent = cleanedContent.slice(3);
    if (cleanedContent.endsWith('```')) cleanedContent = cleanedContent.slice(0, -3);
    cleanedContent = cleanedContent.trim();
    
    const parsed = JSON.parse(cleanedContent);
    
    // Validate response - ensure "null" strings become actual null
    const city = parsed.city === 'null' || parsed.city === '' ? null : parsed.city;
    const state = parsed.state === 'null' || parsed.state === '' ? null : parsed.state;
    
    return { city, state };
  } catch (error) {
    console.error('[Backfill] Error extracting market:', error);
    return { city: null, state: null };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for optional parameters
    let batchSize = 10;
    let dryRun = false;
    try {
      const body = await req.json();
      batchSize = body.batchSize || 10;
      dryRun = body.dryRun || false;
    } catch {
      // Use defaults if no body
    }

    console.log(`[Backfill] Starting market backfill (batchSize: ${batchSize}, dryRun: ${dryRun})`);

    // Find bookings with completed transcriptions but missing market data
    const { data: bookingsToProcess, error: queryError } = await supabase
      .from('bookings')
      .select(`
        id,
        member_name,
        market_city,
        market_state,
        booking_transcriptions!inner(
          call_summary,
          call_key_points
        )
      `)
      .eq('transcription_status', 'completed')
      .or('market_city.is.null,market_city.eq.')
      .limit(batchSize);

    if (queryError) {
      console.error('[Backfill] Query error:', queryError);
      throw new Error(`Failed to query bookings: ${queryError.message}`);
    }

    if (!bookingsToProcess || bookingsToProcess.length === 0) {
      console.log('[Backfill] No bookings found that need market backfill');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No bookings need market backfill',
          processed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Backfill] Found ${bookingsToProcess.length} bookings to process`);

    const results: ProcessingResult[] = [];
    let successCount = 0;
    let enrichedCount = 0;

    for (const booking of bookingsToProcess) {
      try {
        const transcription = (booking as any).booking_transcriptions;
        const callSummary = transcription?.call_summary || null;
        const callKeyPoints = transcription?.call_key_points;
        const propertyAddress = callKeyPoints?.memberDetails?.propertyAddress || null;

        console.log(`[Backfill] Processing booking ${booking.id} (${booking.member_name})`);
        console.log(`[Backfill]   - Summary available: ${!!callSummary}`);
        console.log(`[Backfill]   - Property address: ${propertyAddress || 'none'}`);

        // Extract market info using AI
        const { city, state } = await extractMarketFromTranscription(
          callSummary,
          propertyAddress,
          lovableApiKey
        );

        console.log(`[Backfill]   - Extracted: city=${city}, state=${state}`);

        if (city || state) {
          if (!dryRun) {
            // Update the booking with extracted market data
            const { error: updateError } = await supabase
              .from('bookings')
              .update({
                market_city: city,
                market_state: state
              })
              .eq('id', booking.id);

            if (updateError) {
              console.error(`[Backfill] Update error for ${booking.id}:`, updateError);
              results.push({ bookingId: booking.id, success: false, error: updateError.message });
              continue;
            }
          }

          enrichedCount++;
          results.push({ bookingId: booking.id, success: true, city, state });
        } else {
          results.push({ bookingId: booking.id, success: true, city: null, state: null });
        }

        successCount++;

        // Add small delay between AI calls to avoid rate limiting
        if (bookingsToProcess.indexOf(booking) < bookingsToProcess.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Backfill] Error processing ${booking.id}:`, errorMessage);
        results.push({ bookingId: booking.id, success: false, error: errorMessage });
      }
    }

    // Log API cost estimate
    const estimatedCost = bookingsToProcess.length * 0.0001; // ~$0.0001 per lightweight AI call
    console.log(`[Backfill] Estimated API cost: $${estimatedCost.toFixed(4)}`);

    console.log(`[Backfill] Completed: ${successCount}/${bookingsToProcess.length} processed, ${enrichedCount} enriched`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${successCount} bookings, enriched ${enrichedCount} with market data`,
        processed: successCount,
        enriched: enrichedCount,
        dryRun,
        results,
        estimatedCost: `$${estimatedCost.toFixed(4)}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Backfill] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
