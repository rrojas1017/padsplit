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

interface QAScores {
  scores: Record<string, number>;
  total: number;
  maxTotal: number;
  percentage: number;
  rubricId: string;
  scoredAt: string;
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
      const inputCost = ((params.input_tokens || 0) / 1000) * 0.0001;
      const outputCost = ((params.output_tokens || 0) / 1000) * 0.0003;
      cost = inputCost + outputCost;
    }

    await supabase.from('api_costs').insert({
      ...params,
      estimated_cost_usd: cost
    });
    console.log(`[Cost] Logged ${params.service_type}: $${cost.toFixed(4)}`);
  } catch (error) {
    console.error('[Cost] Failed to log cost:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingId } = await req.json();
    
    if (!bookingId) {
      return new Response(
        JSON.stringify({ error: 'bookingId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch active QA rubric
    const { data: qaSettings, error: qaError } = await supabase
      .from('qa_settings')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (qaError || !qaSettings) {
      console.error('Error fetching QA settings:', qaError);
      return new Response(
        JSON.stringify({ error: 'No active QA rubric found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const categories: QACategory[] = qaSettings.categories;
    const maxTotal = categories.reduce((sum, cat) => sum + cat.maxPoints, 0);

    // Fetch transcription and booking info for cost attribution
    const { data: transcription, error: transError } = await supabase
      .from('booking_transcriptions')
      .select('call_transcription, booking_id')
      .eq('booking_id', bookingId)
      .single();

    if (transError || !transcription?.call_transcription) {
      console.error('Error fetching transcription:', transError);
      return new Response(
        JSON.stringify({ error: 'No transcription found for this booking' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch booking for agent_id and site_id
    const { data: booking } = await supabase
      .from('bookings')
      .select('agent_id, agents(site_id)')
      .eq('id', bookingId)
      .single();

    const agentId = booking?.agent_id || null;
    const siteId = (booking?.agents as any)?.site_id || null;

    // Build the scoring prompt
    const categoryList = categories.map((cat, i) => 
      `${i + 1}. ${cat.name} (0-${cat.maxPoints} points): ${cat.criteria}`
    ).join('\n');

    const prompt = `You are a QA analyst scoring a sales call transcription for PadSplit. Score the call based on this rubric:

${categoryList}

CALL TRANSCRIPTION:
${transcription.call_transcription}

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

    console.log('Calling AI for QA scoring...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a professional QA analyst. Return only valid JSON with no additional text.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'AI scoring failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';
    
    // Log AI cost
    const inputTokens = Math.ceil(prompt.length / 4);
    const outputTokens = Math.ceil(content.length / 4);
    logApiCost(supabase, {
      service_provider: 'lovable_ai',
      service_type: 'ai_qa_scoring',
      edge_function: 'generate-qa-scores',
      booking_id: bookingId,
      agent_id: agentId,
      site_id: siteId,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      metadata: { model: 'google/gemini-2.5-flash' }
    });
    
    console.log('AI response:', content);

    // Parse the JSON response
    let parsedScores: { scores: Record<string, number> };
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      parsedScores = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      return new Response(
        JSON.stringify({ error: 'Failed to parse QA scores' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate and cap scores
    const validatedScores: Record<string, number> = {};
    for (const cat of categories) {
      const score = parsedScores.scores[cat.name];
      validatedScores[cat.name] = Math.min(Math.max(0, score || 0), cat.maxPoints);
    }

    const total = Object.values(validatedScores).reduce((sum, s) => sum + s, 0);
    const percentage = Math.round((total / maxTotal) * 1000) / 10;

    const qaScores: QAScores = {
      scores: validatedScores,
      total,
      maxTotal,
      percentage,
      rubricId: qaSettings.id,
      scoredAt: new Date().toISOString(),
    };

    // Update booking_transcriptions
    const { error: updateError } = await supabase
      .from('booking_transcriptions')
      .update({ qa_scores: qaScores })
      .eq('booking_id', bookingId);

    if (updateError) {
      console.error('Error updating QA scores:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to save QA scores' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`QA scores saved for booking ${bookingId}: ${total}/${maxTotal} (${percentage}%)`);

    return new Response(
      JSON.stringify({ success: true, qaScores }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('generate-qa-scores error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
