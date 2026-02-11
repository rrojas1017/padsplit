import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QACategory {
  name: string;
  maxPoints: number;
  criteria: string;
}

// Cost logging helper
async function logApiCost(supabase: any, params: {
  service_provider: 'elevenlabs' | 'lovable_ai';
  service_type: string;
  edge_function: string;
  booking_id?: string;
  agent_id?: string;
  site_id?: string;
  input_tokens?: number;
  output_tokens?: number;
  audio_duration_seconds?: number;
  character_count?: number;
  metadata?: Record<string, any>;
  triggered_by_user_id?: string;
  is_internal?: boolean;
}) {
  try {
    let cost = 0;
    if (params.service_provider === 'elevenlabs') {
      if (params.audio_duration_seconds) {
        cost += (params.audio_duration_seconds / 60) * 0.10;
      }
      if (params.character_count) {
        cost += params.character_count * 0.0003;
      }
    } else if (params.service_provider === 'lovable_ai') {
      // Model-aware pricing for Lovable AI
      const model = params.metadata?.model || 'google/gemini-2.5-flash';
      let inputRate = 0.0001;  // Flash default: ~$0.0001 per 1K input
      let outputRate = 0.0003; // Flash default: ~$0.0003 per 1K output
      
      if (model.includes('gemini-2.5-pro')) {
        // Gemini Pro: ~$0.00125 per 1K input, ~$0.005 per 1K output
        inputRate = 0.00125;
        outputRate = 0.005;
      }
      
      const inputCost = ((params.input_tokens || 0) / 1000) * inputRate;
      const outputCost = ((params.output_tokens || 0) / 1000) * outputRate;
      cost = inputCost + outputCost;
    }

    await supabase.from('api_costs').insert({
      ...params,
      estimated_cost_usd: cost,
      triggered_by_user_id: params.triggered_by_user_id || null,
      is_internal: params.is_internal || false,
    });
  } catch (error) {
    console.error('[Cost] Failed to log cost:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Fire-and-forget pattern - return immediately
  const processInBackground = async () => {
    try {
      console.log('Starting batch QA scoring...');

      // Fetch active QA rubric
      const { data: qaSettings, error: qaError } = await supabase
        .from('qa_settings')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .single();

      if (qaError || !qaSettings) {
        console.error('No active QA rubric found:', qaError);
        return;
      }

      const categories: QACategory[] = qaSettings.categories;
      const maxTotal = categories.reduce((sum, cat) => sum + cat.maxPoints, 0);

      // Find all transcriptions without QA scores
      const { data: transcriptions, error: fetchError } = await supabase
        .from('booking_transcriptions')
        .select('booking_id, call_transcription')
        .is('qa_scores', null)
        .not('call_transcription', 'is', null)
        .limit(100);

      if (fetchError) {
        console.error('Error fetching transcriptions:', fetchError);
        return;
      }

      if (!transcriptions || transcriptions.length === 0) {
        console.log('No transcriptions need QA scoring');
        return;
      }

      console.log(`Found ${transcriptions.length} transcriptions to score`);

      let succeeded = 0;
      let failed = 0;

      for (const trans of transcriptions) {
        try {
          // Fetch booking for agent_id and site_id
          const { data: booking } = await supabase
            .from('bookings')
            .select('agent_id, agents(site_id)')
            .eq('id', trans.booking_id)
            .single();

          const agentId = booking?.agent_id || null;
          const siteId = (booking?.agents as any)?.site_id || null;

          // Build scoring prompt
          const categoryList = categories.map((cat, i) => 
            `${i + 1}. ${cat.name} (0-${cat.maxPoints} points): ${cat.criteria}`
          ).join('\n');

          const prompt = `You are a QA analyst scoring a sales call transcription for PadSplit. Score the call based on this rubric:

${categoryList}

CALL TRANSCRIPTION:
${trans.call_transcription}

INSTRUCTIONS:
- Score each category from 0 to its maximum points
- Be fair but thorough - look for specific evidence of each criterion
- If a category isn't demonstrated, give minimal points
- Return ONLY valid JSON in this exact format:

{
  "scores": {
${categories.map(cat => `    "${cat.name}": <score 0-${cat.maxPoints}>`).join(',\n')}
  }
}`;

          const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${lovableApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-pro',
              messages: [
                { role: 'system', content: 'You are a professional QA analyst. Return only valid JSON with no additional text.' },
                { role: 'user', content: prompt }
              ],
            }),
          });

          if (!aiResponse.ok) {
            console.error(`AI error for ${trans.booking_id}:`, await aiResponse.text());
            failed++;
            continue;
          }

          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content || '';

          // Log AI cost
          const inputTokens = Math.ceil(prompt.length / 4);
          const outputTokens = Math.ceil(content.length / 4);
          logApiCost(supabase, {
            service_provider: 'lovable_ai',
            service_type: 'ai_qa_scoring',
            edge_function: 'batch-generate-qa-scores',
            booking_id: trans.booking_id,
            agent_id: agentId,
            site_id: siteId,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            metadata: { model: 'google/gemini-2.5-pro', batch: true }
          });

          // Parse scores
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            console.error(`No JSON found for ${trans.booking_id}`);
            failed++;
            continue;
          }

          const parsedScores = JSON.parse(jsonMatch[0]);

          // Validate and cap scores
          const validatedScores: Record<string, number> = {};
          for (const cat of categories) {
            const score = parsedScores.scores[cat.name];
            validatedScores[cat.name] = Math.min(Math.max(0, score || 0), cat.maxPoints);
          }

          const total = Object.values(validatedScores).reduce((sum, s) => sum + s, 0);
          const percentage = Math.round((total / maxTotal) * 1000) / 10;

          const qaScores = {
            scores: validatedScores,
            total,
            maxTotal,
            percentage,
            rubricId: qaSettings.id,
            scoredAt: new Date().toISOString(),
          };

          // Update transcription
          const { error: updateError } = await supabase
            .from('booking_transcriptions')
            .update({ qa_scores: qaScores })
            .eq('booking_id', trans.booking_id);

          if (updateError) {
            console.error(`Error saving QA scores for ${trans.booking_id}:`, updateError);
            failed++;
          } else {
            console.log(`Scored ${trans.booking_id}: ${total}/${maxTotal} (${percentage}%)`);
            succeeded++;
          }

          // 3-second delay between calls to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 3000));

        } catch (err) {
          console.error(`Error processing ${trans.booking_id}:`, err);
          failed++;
        }
      }

      console.log(`Batch QA scoring complete: ${succeeded} succeeded, ${failed} failed`);

    } catch (error) {
      console.error('Batch QA scoring error:', error);
    }
  };

  // Fire-and-forget: start processing without awaiting
  processInBackground();

  return new Response(
    JSON.stringify({ 
      success: true, 
      message: 'Batch QA scoring started. Check logs for progress.' 
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
