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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) throw new Error('LOVABLE_API_KEY not configured');

    // Verify caller is super_admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleData?.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Forbidden: super_admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json().catch(() => ({}));
    const batchSize = body.batchSize || 50;
    const startDate = body.startDate || null;
    const endDate = body.endDate || null;
    const startTime = Date.now();
    const MAX_DURATION_MS = 45000; // 45 seconds max

    let totalProcessed = 0;
    let totalFailed = 0;

    // Process in a loop until timeout or no more records
    while (Date.now() - startTime < MAX_DURATION_MS) {
      // Fetch transcriptions that need lifestyle signal extraction
      // Join with bookings to get booking_date for date filtering and ordering
      let query = supabase
        .from('booking_transcriptions')
        .select('id, booking_id, call_transcription, call_key_points, bookings!inner(booking_date)')
        .not('call_transcription', 'is', null)
        .not('call_key_points', 'is', null)
        .is('call_key_points->lifestyleSignals', null)
        .limit(batchSize);

      if (startDate) query = query.gte('bookings.booking_date', startDate);
      if (endDate) query = query.lte('bookings.booking_date', endDate);

      const { data: candidates, error: fetchError } = await query;

      if (fetchError) {
        console.error(`[Backfill] Fetch error:`, fetchError.message);
        // If the join/order fails, try simpler query without ordering
        break;
      }

      // DB-level filter handles this now; safety net only
      const toProcess = candidates || [];

      if (toProcess.length === 0) {
        console.log(`[Backfill] No more records to process`);
        break;
      }

      console.log(`[Backfill] Processing ${toProcess.length} transcriptions (elapsed: ${Date.now() - startTime}ms)`);

      for (const record of toProcess) {
        // Check timeout before each record
        if (Date.now() - startTime > MAX_DURATION_MS) {
          console.log(`[Backfill] Timeout reached, stopping`);
          break;
        }

        try {
          const transcription = record.call_transcription as string;
          if (!transcription || transcription.length < 50) {
            // Mark as processed with empty signals so it's not refetched
            const existingKP = record.call_key_points as any;
            await supabase
              .from('booking_transcriptions')
              .update({ call_key_points: { ...existingKP, lifestyleSignals: [] } })
              .eq('id', record.id);
            totalProcessed++;
            console.log(`[Backfill] Marked ${record.booking_id} with empty signals (too short)`);
            continue;
          }

          const prompt = `Analyze this call transcript and extract ONLY lifestyle signals that indicate cross-sell or upsell opportunities.

CATEGORIES:
- healthcare: no insurance, need coverage, ACA/Obamacare, medical needs
- pet: dogs, cats, pets, pet-friendly, pet deposits
- transportation: car details, no car, rideshare, bus, transit
- home_services: furniture, cleaning, WiFi/internet, laundry, appliances
- telephony: phone plan issues, no phone service, prepaid phone
- employment: job searching, work schedule, unemployment, gig work
- financial: payment difficulties, no bank account, credit issues
- moving: moving help, storage, shipping, U-Haul

TRANSCRIPT (excerpt):
${transcription.substring(0, 6000)}

Return ONLY a JSON object (no markdown):
{
  "lifestyleSignals": [
    {
      "category": "one of the categories above",
      "signal": "exact quote or paraphrase",
      "confidence": "high | medium | low",
      "opportunity": "brief cross-sell opportunity"
    }
  ]
}

If no lifestyle signals are detected, return: {"lifestyleSignals": []}`;

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
            console.error(`[Backfill] AI error for ${record.booking_id}: ${response.status}`);
            totalFailed++;
            continue;
          }

          const result = await response.json();
          let content = result.choices?.[0]?.message?.content?.trim() || '';
          
          // Clean JSON
          if (content.startsWith('```json')) content = content.slice(7);
          if (content.startsWith('```')) content = content.slice(3);
          if (content.endsWith('```')) content = content.slice(0, -3);
          content = content.trim();

          const parsed = JSON.parse(content);
          const signals = parsed.lifestyleSignals || [];

          // Update the existing call_key_points with lifestyleSignals
          const existingKeyPoints = record.call_key_points as any;
          const updatedKeyPoints = { ...existingKeyPoints, lifestyleSignals: signals };

          const { error: updateError } = await supabase
            .from('booking_transcriptions')
            .update({ 
              call_key_points: updatedKeyPoints,
              updated_at: new Date().toISOString()
            })
            .eq('id', record.id);

          if (updateError) {
            console.error(`[Backfill] Update error for ${record.booking_id}:`, updateError);
            totalFailed++;
          } else {
            totalProcessed++;
            console.log(`[Backfill] Extracted ${signals.length} signals for ${record.booking_id}`);
          }

          // Rate limiting: 300ms between requests
          await new Promise(resolve => setTimeout(resolve, 300));

        } catch (err) {
          console.error(`[Backfill] Error processing ${record.booking_id}:`, err);
          totalFailed++;
        }
      }
    }

    // Count remaining records that still need processing (no lifestyleSignals)
    // We fetch a sample and filter since we can't query JSON absence directly
    let remainingCount = 0;
    try {
      let countQuery = supabase
        .from('booking_transcriptions')
        .select('id, bookings!inner(booking_date)', { count: 'exact', head: true })
        .not('call_transcription', 'is', null)
        .not('call_key_points', 'is', null)
        .is('call_key_points->lifestyleSignals', null);

      if (startDate) countQuery = countQuery.gte('bookings.booking_date', startDate);
      if (endDate) countQuery = countQuery.lte('bookings.booking_date', endDate);

      const { count } = await countQuery;

      remainingCount = count || 0;
    } catch (e) {
      console.error('[Backfill] Error counting remaining:', e);
    }

    return new Response(JSON.stringify({
      success: true,
      processed: totalProcessed,
      failed: totalFailed,
      remaining: remainingCount,
      elapsedMs: Date.now() - startTime,
      message: `Processed ${totalProcessed} transcriptions, ${totalFailed} failed, ~${remainingCount} remaining`
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
