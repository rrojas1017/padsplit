import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cost estimation based on current API pricing
const PRICING = {
  elevenlabs: {
    tts_per_character: 0.0003, // ~$0.30 per 1,000 characters
    stt_per_minute: 0.10,      // ~$0.10 per minute
  },
  lovable_ai: {
    input_per_1k_tokens: 0.0001,
    output_per_1k_tokens: 0.0003,
  },
};

function estimateTokens(text: string | null): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function calculateLovableAICost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1000) * PRICING.lovable_ai.input_per_1k_tokens;
  const outputCost = (outputTokens / 1000) * PRICING.lovable_ai.output_per_1k_tokens;
  return inputCost + outputCost;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting historical cost backfill...');

    // Fetch all booking_transcriptions with their booking data
    const { data: transcriptions, error: fetchError } = await supabase
      .from('booking_transcriptions')
      .select(`
        id,
        booking_id,
        call_transcription,
        call_summary,
        call_key_points,
        agent_feedback,
        coaching_audio_url,
        coaching_audio_generated_at,
        qa_scores,
        qa_coaching_audio_url,
        qa_coaching_audio_generated_at,
        created_at,
        bookings!inner (
          id,
          agent_id,
          call_duration_seconds,
          agents!inner (
            id,
            site_id
          )
        )
      `);

    if (fetchError) {
      console.error('Error fetching transcriptions:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${transcriptions?.length || 0} transcriptions to backfill`);

    const costRecords: any[] = [];
    let totalEstimatedCost = 0;

    for (const t of transcriptions || []) {
      const booking = t.bookings as any;
      const agentId = booking?.agent_id;
      const siteId = booking?.agents?.site_id;
      const callDurationSeconds = booking?.call_duration_seconds || 0;
      const transcriptionDate = t.created_at || new Date().toISOString();

      // 1. ElevenLabs STT Cost (if there's a transcription)
      if (t.call_transcription && callDurationSeconds > 0) {
        const sttCost = (callDurationSeconds / 60) * PRICING.elevenlabs.stt_per_minute;
        costRecords.push({
          service_provider: 'elevenlabs',
          service_type: 'stt_transcription',
          edge_function: 'transcribe-call',
          booking_id: t.booking_id,
          agent_id: agentId,
          site_id: siteId,
          audio_duration_seconds: callDurationSeconds,
          estimated_cost_usd: sttCost,
          created_at: transcriptionDate,
          metadata: { backfilled: true },
        });
        totalEstimatedCost += sttCost;
      }

      // 2. Lovable AI Analysis Cost (for transcription analysis)
      if (t.call_transcription && t.call_summary) {
        const inputTokens = estimateTokens(t.call_transcription) + 500; // prompt overhead
        const summaryTokens = estimateTokens(t.call_summary);
        const keyPointsTokens = t.call_key_points ? estimateTokens(JSON.stringify(t.call_key_points)) : 200;
        const outputTokens = summaryTokens + keyPointsTokens;
        const aiCost = calculateLovableAICost(inputTokens, outputTokens);
        
        costRecords.push({
          service_provider: 'lovable_ai',
          service_type: 'ai_analysis',
          edge_function: 'transcribe-call',
          booking_id: t.booking_id,
          agent_id: agentId,
          site_id: siteId,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          estimated_cost_usd: aiCost,
          created_at: transcriptionDate,
          metadata: { backfilled: true },
        });
        totalEstimatedCost += aiCost;
      }

      // 3. Lovable AI Coaching Cost (if agent_feedback exists)
      if (t.agent_feedback) {
        const inputTokens = estimateTokens(t.call_transcription) + 800; // prompt overhead
        const outputTokens = estimateTokens(JSON.stringify(t.agent_feedback));
        const coachingAiCost = calculateLovableAICost(inputTokens, outputTokens);
        
        costRecords.push({
          service_provider: 'lovable_ai',
          service_type: 'ai_coaching',
          edge_function: 'transcribe-call',
          booking_id: t.booking_id,
          agent_id: agentId,
          site_id: siteId,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          estimated_cost_usd: coachingAiCost,
          created_at: transcriptionDate,
          metadata: { backfilled: true },
        });
        totalEstimatedCost += coachingAiCost;
      }

      // 4. ElevenLabs TTS Cost (Jeff coaching audio)
      if (t.coaching_audio_url) {
        // Estimate ~500 characters for coaching script
        const estimatedChars = 500;
        const ttsCost = estimatedChars * PRICING.elevenlabs.tts_per_character;
        const audioDate = t.coaching_audio_generated_at || transcriptionDate;
        
        costRecords.push({
          service_provider: 'elevenlabs',
          service_type: 'tts_coaching',
          edge_function: 'generate-coaching-audio',
          booking_id: t.booking_id,
          agent_id: agentId,
          site_id: siteId,
          character_count: estimatedChars,
          estimated_cost_usd: ttsCost,
          created_at: audioDate,
          metadata: { backfilled: true },
        });
        totalEstimatedCost += ttsCost;
      }

      // 5. Lovable AI QA Scoring Cost (if qa_scores exists)
      if (t.qa_scores) {
        const inputTokens = estimateTokens(t.call_transcription) + 1000; // rubric + prompt overhead
        const outputTokens = estimateTokens(JSON.stringify(t.qa_scores));
        const qaScoringCost = calculateLovableAICost(inputTokens, outputTokens);
        
        costRecords.push({
          service_provider: 'lovable_ai',
          service_type: 'ai_qa_scoring',
          edge_function: 'generate-qa-scores',
          booking_id: t.booking_id,
          agent_id: agentId,
          site_id: siteId,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          estimated_cost_usd: qaScoringCost,
          created_at: transcriptionDate,
          metadata: { backfilled: true },
        });
        totalEstimatedCost += qaScoringCost;
      }

      // 6. ElevenLabs TTS Cost (Katty QA coaching audio)
      if (t.qa_coaching_audio_url) {
        // Estimate ~500 characters for QA coaching script
        const estimatedChars = 500;
        const ttsCost = estimatedChars * PRICING.elevenlabs.tts_per_character;
        const audioDate = t.qa_coaching_audio_generated_at || transcriptionDate;
        
        costRecords.push({
          service_provider: 'elevenlabs',
          service_type: 'tts_qa_coaching',
          edge_function: 'generate-qa-coaching-audio',
          booking_id: t.booking_id,
          agent_id: agentId,
          site_id: siteId,
          character_count: estimatedChars,
          estimated_cost_usd: ttsCost,
          created_at: audioDate,
          metadata: { backfilled: true },
        });
        totalEstimatedCost += ttsCost;
      }

      // 7. Lovable AI for Katty script generation (if qa_coaching_audio exists)
      if (t.qa_coaching_audio_url && t.qa_scores) {
        const inputTokens = estimateTokens(t.call_transcription) + estimateTokens(JSON.stringify(t.qa_scores)) + 500;
        const outputTokens = 200; // Script output
        const kattyAiCost = calculateLovableAICost(inputTokens, outputTokens);
        
        costRecords.push({
          service_provider: 'lovable_ai',
          service_type: 'ai_coaching',
          edge_function: 'generate-qa-coaching-audio',
          booking_id: t.booking_id,
          agent_id: agentId,
          site_id: siteId,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          estimated_cost_usd: kattyAiCost,
          created_at: t.qa_coaching_audio_generated_at || transcriptionDate,
          metadata: { backfilled: true },
        });
        totalEstimatedCost += kattyAiCost;
      }
    }

    console.log(`Prepared ${costRecords.length} cost records, total estimated: $${totalEstimatedCost.toFixed(2)}`);

    // Insert all cost records in batches
    const batchSize = 100;
    let inserted = 0;
    
    for (let i = 0; i < costRecords.length; i += batchSize) {
      const batch = costRecords.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from('api_costs')
        .insert(batch);
      
      if (insertError) {
        console.error(`Error inserting batch ${i / batchSize + 1}:`, insertError);
        throw insertError;
      }
      inserted += batch.length;
      console.log(`Inserted ${inserted}/${costRecords.length} records`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Backfilled ${costRecords.length} cost records`,
        transcriptionsProcessed: transcriptions?.length || 0,
        totalCostRecords: costRecords.length,
        totalEstimatedCost: totalEstimatedCost.toFixed(4),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Backfill error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
