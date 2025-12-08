import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Pro Plan Pricing (corrected from Pay-As-You-Go rates)
const PRO_PRICING = {
  stt_per_minute: 0.034,       // Was 0.10 (pay-as-you-go)
  tts_per_character: 0.00015,  // Was 0.0003 (pay-as-you-go)
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting Pro plan pricing recalculation...');

    // Fetch all ElevenLabs STT records
    const { data: sttRecords, error: sttError } = await supabase
      .from('api_costs')
      .select('id, audio_duration_seconds, estimated_cost_usd')
      .eq('service_provider', 'elevenlabs')
      .eq('service_type', 'stt_transcription');

    if (sttError) throw sttError;

    console.log(`Found ${sttRecords?.length || 0} STT records to recalculate`);

    // Fetch all ElevenLabs TTS records
    const { data: ttsRecords, error: ttsError } = await supabase
      .from('api_costs')
      .select('id, character_count, estimated_cost_usd, service_type')
      .eq('service_provider', 'elevenlabs')
      .in('service_type', ['tts_coaching', 'tts_qa_coaching']);

    if (ttsError) throw ttsError;

    console.log(`Found ${ttsRecords?.length || 0} TTS records to recalculate`);

    let sttUpdated = 0;
    let ttsUpdated = 0;
    let oldTotalCost = 0;
    let newTotalCost = 0;

    // Recalculate STT costs
    for (const record of sttRecords || []) {
      const durationMinutes = (record.audio_duration_seconds || 0) / 60;
      const newCost = durationMinutes * PRO_PRICING.stt_per_minute;
      
      oldTotalCost += record.estimated_cost_usd || 0;
      newTotalCost += newCost;

      const { error: updateError } = await supabase
        .from('api_costs')
        .update({ estimated_cost_usd: newCost })
        .eq('id', record.id);

      if (updateError) {
        console.error(`Failed to update STT record ${record.id}:`, updateError);
      } else {
        sttUpdated++;
      }
    }

    // Recalculate TTS costs
    for (const record of ttsRecords || []) {
      const newCost = (record.character_count || 0) * PRO_PRICING.tts_per_character;
      
      oldTotalCost += record.estimated_cost_usd || 0;
      newTotalCost += newCost;

      const { error: updateError } = await supabase
        .from('api_costs')
        .update({ estimated_cost_usd: newCost })
        .eq('id', record.id);

      if (updateError) {
        console.error(`Failed to update TTS record ${record.id}:`, updateError);
      } else {
        ttsUpdated++;
      }
    }

    const savings = oldTotalCost - newTotalCost;

    console.log('Recalculation complete!');
    console.log(`STT records updated: ${sttUpdated}`);
    console.log(`TTS records updated: ${ttsUpdated}`);
    console.log(`Old total cost: $${oldTotalCost.toFixed(2)}`);
    console.log(`New total cost: $${newTotalCost.toFixed(2)}`);
    console.log(`Savings: $${savings.toFixed(2)}`);

    return new Response(JSON.stringify({
      success: true,
      summary: {
        stt_records_updated: sttUpdated,
        tts_records_updated: ttsUpdated,
        total_records_updated: sttUpdated + ttsUpdated,
        old_total_cost_usd: Number(oldTotalCost.toFixed(4)),
        new_total_cost_usd: Number(newTotalCost.toFixed(4)),
        savings_usd: Number(savings.toFixed(4)),
      },
      pricing_applied: {
        stt_per_minute: PRO_PRICING.stt_per_minute,
        tts_per_character: PRO_PRICING.tts_per_character,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error recalculating costs:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
