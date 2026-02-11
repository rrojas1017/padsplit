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
        model: 'google/gemini-2.5-flash-lite',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      console.error('[Backfill] AI request failed:', response.status);
      return { city: null, state: null };
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';
    
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```json')) cleanedContent = cleanedContent.slice(7);
    if (cleanedContent.startsWith('```')) cleanedContent = cleanedContent.slice(3);
    if (cleanedContent.endsWith('```')) cleanedContent = cleanedContent.slice(0, -3);
    cleanedContent = cleanedContent.trim();
    
    const parsed = JSON.parse(cleanedContent);
    const city = parsed.city === 'null' || parsed.city === '' ? null : parsed.city;
    const state = parsed.state === 'null' || parsed.state === '' ? null : parsed.state;
    
    return { city, state };
  } catch (error) {
    console.error('[Backfill] Error extracting market:', error);
    return { city: null, state: null };
  }
}

// Process a chunk of bookings in parallel
async function processChunk(
  chunk: any[],
  supabase: any,
  lovableApiKey: string,
  dryRun: boolean
): Promise<ProcessingResult[]> {
  const promises = chunk.map(async (booking) => {
    try {
      const transcription = (booking as any).booking_transcriptions;
      const callSummary = transcription?.call_summary || null;
      const callKeyPoints = transcription?.call_key_points;
      const propertyAddress = callKeyPoints?.memberDetails?.propertyAddress || null;

      const { city, state } = await extractMarketFromTranscription(callSummary, propertyAddress, lovableApiKey);

      if (!dryRun) {
        const updateData: Record<string, unknown> = { market_backfill_checked: true };
        if (city) updateData.market_city = city;
        if (state) updateData.market_state = state;

        const { error: updateError } = await supabase
          .from('bookings')
          .update(updateData)
          .eq('id', booking.id);

        if (updateError) {
          return { bookingId: booking.id, success: false, error: updateError.message };
        }
      }

      return { bookingId: booking.id, success: true, city, state };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { bookingId: booking.id, success: false, error: msg };
    }
  });

  return Promise.all(promises);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    if (!lovableApiKey) throw new Error('LOVABLE_API_KEY not configured');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let batchSize = 50;
    let dryRun = false;
    try {
      const body = await req.json();
      batchSize = body.batchSize || 50;
      dryRun = body.dryRun || false;
    } catch { /* defaults */ }

    console.log(`[Backfill] Starting (batchSize: ${batchSize}, dryRun: ${dryRun})`);

    // Fetch bookings missing market data with completed transcriptions
    const { data: bookingsToProcess, error: queryError } = await supabase
      .from('bookings')
      .select(`
        id, member_name, market_city, market_state,
        booking_transcriptions!inner(call_summary, call_key_points)
      `)
      .eq('transcription_status', 'completed')
      .eq('market_backfill_checked', false)
      .is('market_city', null)
      .limit(batchSize);

    if (queryError) throw new Error(`Query failed: ${queryError.message}`);

    if (!bookingsToProcess || bookingsToProcess.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No bookings need backfill', processed: 0, enriched: 0, remaining: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get remaining count for self-chaining
    const { count: remainingCount } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('transcription_status', 'completed')
      .eq('market_backfill_checked', false)
      .is('market_city', null);

    console.log(`[Backfill] Processing ${bookingsToProcess.length}, ~${remainingCount} total remaining`);

    // Process in parallel chunks of 5
    const CONCURRENCY = 5;
    const results: ProcessingResult[] = [];
    
    for (let i = 0; i < bookingsToProcess.length; i += CONCURRENCY) {
      const chunk = bookingsToProcess.slice(i, i + CONCURRENCY);
      const chunkResults = await processChunk(chunk, supabase, lovableApiKey, dryRun);
      results.push(...chunkResults);
      
      // Brief delay between concurrent groups
      if (i + CONCURRENCY < bookingsToProcess.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    const successCount = results.filter(r => r.success).length;
    const enrichedCount = results.filter(r => r.success && (r.city || r.state)).length;
    const remaining = Math.max(0, (remainingCount || 0) - successCount);

    console.log(`[Backfill] Done: ${successCount} processed, ${enrichedCount} enriched, ${remaining} remaining`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: successCount,
        enriched: enrichedCount,
        remaining,
        dryRun,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Backfill] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
