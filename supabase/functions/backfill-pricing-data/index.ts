import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function extractPricingFromTranscription(
  transcription: string,
  lovableApiKey: string
): Promise<{ mentioned: boolean; details: string; agentInitiated: boolean; quotedRoomPrice: number | null } | null> {
  const prompt = `Analyze this PadSplit call transcription and extract pricing discussion information.

TRANSCRIPTION:
${transcription.slice(0, 6000)}

Extract ONLY pricing-related information. Return a JSON object:
{
  "mentioned": true/false (was pricing/cost discussed at all?),
  "details": "brief summary of pricing discussion" or "" if not mentioned,
  "agentInitiated": true/false (did the agent proactively bring up pricing?),
  "quotedRoomPrice": number or null (weekly room rate quoted by agent in dollars, e.g. 185 for "$185/week")
}

Rules:
- quotedRoomPrice should be the weekly rate only, not deposits or move-in costs
- If multiple prices quoted, use the primary/first one
- If price is monthly, divide by 4 to get weekly
- Return ONLY the JSON object, no markdown`;

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
      console.error('[BackfillPricing] AI request failed:', response.status);
      return null;
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';
    
    let cleaned = content.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    cleaned = cleaned.trim();
    
    const parsed = JSON.parse(cleaned);
    return {
      mentioned: !!parsed.mentioned,
      details: parsed.details || '',
      agentInitiated: !!parsed.agentInitiated,
      quotedRoomPrice: typeof parsed.quotedRoomPrice === 'number' ? parsed.quotedRoomPrice : null,
    };
  } catch (error) {
    console.error('[BackfillPricing] Error extracting pricing:', error);
    return null;
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
    if (!lovableApiKey) throw new Error('LOVABLE_API_KEY not configured');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let batchSize = 20;
    try {
      const body = await req.json();
      batchSize = body.batchSize || 20;
    } catch { /* defaults */ }

    console.log(`[BackfillPricing] Starting (batchSize: ${batchSize})`);

    // Find records with transcription + call_key_points but missing pricingDiscussed
    // We query booking_transcriptions that have call_transcription and call_key_points
    const { data: records, error: queryError } = await supabase
      .from('booking_transcriptions')
      .select('id, booking_id, call_transcription, call_key_points')
      .not('call_transcription', 'is', null)
      .not('call_key_points', 'is', null)
      .limit(batchSize);

    if (queryError) throw new Error(`Query failed: ${queryError.message}`);

    // Filter in code: only those missing pricingDiscussed
    const needsBackfill = (records || []).filter(r => {
      const kp = r.call_key_points as any;
      return !kp?.pricingDiscussed;
    });

    if (needsBackfill.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, remaining: 0, message: 'No records need pricing backfill' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get total remaining count
    const { data: allMissing } = await supabase
      .from('booking_transcriptions')
      .select('id, call_key_points')
      .not('call_transcription', 'is', null)
      .not('call_key_points', 'is', null)
      .limit(5000);

    const totalRemaining = (allMissing || []).filter(r => {
      const kp = r.call_key_points as any;
      return !kp?.pricingDiscussed;
    }).length;

    console.log(`[BackfillPricing] Processing ${needsBackfill.length}, ~${totalRemaining} total remaining`);

    let processed = 0;
    const CONCURRENCY = 5;

    for (let i = 0; i < needsBackfill.length; i += CONCURRENCY) {
      const chunk = needsBackfill.slice(i, i + CONCURRENCY);
      
      const promises = chunk.map(async (record) => {
        try {
          const pricing = await extractPricingFromTranscription(record.call_transcription!, lovableApiKey);
          if (!pricing) return false;

          const existingKp = (record.call_key_points || {}) as Record<string, unknown>;
          const updatedKp = { ...existingKp, pricingDiscussed: pricing };

          const { error: updateError } = await supabase
            .from('booking_transcriptions')
            .update({ call_key_points: updatedKp, updated_at: new Date().toISOString() })
            .eq('id', record.id);

          if (updateError) {
            console.error(`[BackfillPricing] Update failed for ${record.id}:`, updateError.message);
            return false;
          }

          // Also update the bookings table call_key_points
          const { error: bookingUpdateError } = await supabase
            .from('bookings')
            .update({ call_key_points: updatedKp })
            .eq('id', record.booking_id);

          if (bookingUpdateError) {
            console.error(`[BackfillPricing] Booking update failed for ${record.booking_id}:`, bookingUpdateError.message);
          }

          return true;
        } catch (err) {
          console.error(`[BackfillPricing] Error processing ${record.id}:`, err);
          return false;
        }
      });

      const results = await Promise.all(promises);
      processed += results.filter(Boolean).length;

      if (i + CONCURRENCY < needsBackfill.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    const remaining = Math.max(0, totalRemaining - processed);
    console.log(`[BackfillPricing] Done: ${processed} processed, ${remaining} remaining`);

    return new Response(
      JSON.stringify({ success: true, processed, remaining }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[BackfillPricing] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
