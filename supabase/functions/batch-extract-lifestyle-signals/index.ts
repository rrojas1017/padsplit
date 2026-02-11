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
    const batchSize = body.batchSize || 10;

    // Find transcriptions that have call_key_points but no lifestyleSignals
    // We check for records where call_key_points exists and call_transcription exists
    const { data: candidates, error: fetchError } = await supabase
      .from('booking_transcriptions')
      .select('id, booking_id, call_transcription, call_key_points')
      .not('call_transcription', 'is', null)
      .not('call_key_points', 'is', null)
      .limit(batchSize);

    if (fetchError) throw new Error(`Fetch error: ${fetchError.message}`);

    // Filter to only those without lifestyleSignals already
    const toProcess = (candidates || []).filter(c => {
      const kp = c.call_key_points as any;
      return !kp?.lifestyleSignals || !Array.isArray(kp.lifestyleSignals);
    });

    if (toProcess.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No transcriptions need lifestyle signal extraction',
        processed: 0,
        remaining: 0
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[Backfill] Processing ${toProcess.length} transcriptions for lifestyle signals`);

    let processed = 0;
    let failed = 0;

    for (const record of toProcess) {
      try {
        const transcription = record.call_transcription as string;
        if (!transcription || transcription.length < 50) {
          console.log(`[Backfill] Skipping ${record.booking_id}: transcription too short`);
          continue;
        }

        // Use Flash-lite for cost efficiency
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
          failed++;
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
          failed++;
        } else {
          processed++;
          console.log(`[Backfill] Extracted ${signals.length} signals for ${record.booking_id}`);
        }

        // Rate limiting: 500ms between requests
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (err) {
        console.error(`[Backfill] Error processing ${record.booking_id}:`, err);
        failed++;
      }
    }

    // Count remaining
    const { count: remainingCount } = await supabase
      .from('booking_transcriptions')
      .select('id', { count: 'exact', head: true })
      .not('call_transcription', 'is', null)
      .not('call_key_points', 'is', null);

    return new Response(JSON.stringify({
      success: true,
      processed,
      failed,
      remaining: (remainingCount || 0) - processed,
      message: `Processed ${processed} transcriptions, ${failed} failed`
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
