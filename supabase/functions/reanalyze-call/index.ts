import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Types for call type configuration
interface CallTypeConfig {
  callType: {
    name: string;
    analysis_focus: string | null;
    scoring_criteria: Record<string, number> | null;
  } | null;
  knowledge: Array<{
    title: string;
    content: string;
    category: string;
  }>;
  rules: Array<{
    rule_name: string;
    rule_type: string;
    rule_description: string | null;
    ai_instruction: string | null;
    weight: number;
  }>;
  script: {
    name: string;
    script_content: string;
  } | null;
}

// Model selection threshold (5 minutes = 300 seconds)
const ANALYSIS_MODEL_THRESHOLD_SECONDS = 300;

// Select AI model based on call duration for cost optimization
function selectAnalysisModel(callDurationSeconds: number | null): string {
  if (!callDurationSeconds || callDurationSeconds < ANALYSIS_MODEL_THRESHOLD_SECONDS) {
    console.log(`[Model] Using Flash for ${callDurationSeconds || 0}s call (< 5 min threshold)`);
    return 'google/gemini-2.5-flash';
  }
  
  console.log(`[Model] Using Pro for ${callDurationSeconds}s call (≥ 5 min threshold)`);
  return 'google/gemini-2.5-pro';
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
      // Model-aware pricing for Lovable AI
      const model = params.metadata?.model || 'google/gemini-2.5-flash';
      let inputRate = 0.0000003;  // Flash: $0.30 per 1M tokens
      let outputRate = 0.0000025; // Flash: $2.50 per 1M tokens
      
      if (model.includes('gemini-2.5-pro')) {
        // Gemini Pro: $1.25 per 1M input, $10.00 per 1M output
        inputRate = 0.00000125;
        outputRate = 0.00001;
      } else if (model.includes('gemini-2.5-flash-lite')) {
        // Flash-lite: $0.075 per 1M input, $0.30 per 1M output
        inputRate = 0.000000075;
        outputRate = 0.0000003;
      }
      
      const inputCost = (params.input_tokens || 0) * inputRate;
      const outputCost = (params.output_tokens || 0) * outputRate;
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

// Fetch call type configuration from database
async function fetchCallTypeConfig(
  supabase: any,
  callTypeId: string | null
): Promise<CallTypeConfig | null> {
  if (!callTypeId) {
    console.log('[Config] No call_type_id provided, using default prompt');
    return null;
  }

  try {
    const { data: callType, error: callTypeError } = await supabase
      .from('call_types')
      .select('name, analysis_focus, scoring_criteria')
      .eq('id', callTypeId)
      .eq('is_active', true)
      .maybeSingle();

    if (callTypeError || !callType) {
      console.log('[Config] Call type not found or inactive:', callTypeId);
      return null;
    }

    const { data: knowledge, error: knowledgeError } = await supabase
      .from('company_knowledge')
      .select('title, content, category')
      .eq('is_active', true)
      .contains('call_type_ids', [callTypeId])
      .order('priority', { ascending: false });

    if (knowledgeError) {
      console.log('[Config] Error fetching knowledge:', knowledgeError);
    }

    const { data: rules, error: rulesError } = await supabase
      .from('call_type_rules')
      .select('rule_name, rule_type, rule_description, ai_instruction, weight')
      .eq('call_type_id', callTypeId)
      .eq('is_active', true)
      .order('weight', { ascending: false });

    if (rulesError) {
      console.log('[Config] Error fetching rules:', rulesError);
    }

    const { data: script, error: scriptError } = await supabase
      .from('script_templates')
      .select('name, script_content')
      .eq('call_type_id', callTypeId)
      .eq('is_active', true)
      .maybeSingle();

    if (scriptError) {
      console.log('[Config] Error fetching script:', scriptError);
    }

    console.log(`[Config] Loaded config for call type "${callType.name}":`, {
      hasAnalysisFocus: !!callType.analysis_focus,
      knowledgeCount: knowledge?.length || 0,
      rulesCount: rules?.length || 0,
      hasScript: !!script
    });

    return {
      callType,
      knowledge: knowledge || [],
      rules: rules || [],
      script: script || null
    };
  } catch (error) {
    console.error('[Config] Error fetching call type config:', error);
    return null;
  }
}

// Build dynamic analysis prompt based on configuration
function buildDynamicAnalysisPrompt(transcription: string, config: CallTypeConfig | null): string {
  if (!config) {
    return buildDefaultAnalysisPrompt(transcription);
  }

  const sections: string[] = [];

  sections.push(`You are an expert at analyzing sales call transcriptions for PadSplit, a housing/rental service.
This is a "${config.callType?.name || 'General'}" call type.`);

  if (config.callType?.analysis_focus) {
    sections.push(`
ANALYSIS FOCUS:
${config.callType.analysis_focus}`);
  }

  if (config.knowledge.length > 0) {
    sections.push(`
COMPANY KNOWLEDGE (use this context when analyzing):
${config.knowledge.map(k => `
[${k.category.toUpperCase()}] ${k.title}:
${k.content}`).join('\n')}`);
  }

  const requiredRules = config.rules.filter(r => r.rule_type === 'required');
  const recommendedRules = config.rules.filter(r => r.rule_type === 'recommended');
  const prohibitedRules = config.rules.filter(r => r.rule_type === 'prohibited');

  if (requiredRules.length > 0 || recommendedRules.length > 0 || prohibitedRules.length > 0) {
    sections.push(`
EVALUATION CRITERIA:`);

    if (requiredRules.length > 0) {
      sections.push(`
REQUIRED (agent MUST do these - mark as improvement if missing):
${requiredRules.map(r => `- ${r.rule_name}: ${r.ai_instruction || r.rule_description || ''}`).join('\n')}`);
    }

    if (recommendedRules.length > 0) {
      sections.push(`
RECOMMENDED (positive if done, note if missing):
${recommendedRules.map(r => `- ${r.rule_name}: ${r.ai_instruction || r.rule_description || ''}`).join('\n')}`);
    }

    if (prohibitedRules.length > 0) {
      sections.push(`
PROHIBITED (flag as issue if detected):
${prohibitedRules.map(r => `- ${r.rule_name}: ${r.ai_instruction || r.rule_description || ''}`).join('\n')}`);
    }
  }

  if (config.script) {
    sections.push(`
SCRIPT TEMPLATE (evaluate adherence):
Script: "${config.script.name}"
${config.script.script_content}

Note: Agent should follow the general structure and key talking points. Minor deviations are acceptable if the conversation flows naturally.`);
  }

  sections.push(`
CRITICAL INSTRUCTIONS:
1. Extract ALL relevant information, even minor mentions
2. If the call is short or limited, still extract what you can
3. NEVER return empty arrays if there's ANY relevant content
4. For short calls (under 2 minutes), adapt your analysis to the available content
5. Be specific - quote or paraphrase actual phrases from the call when possible
6. Evaluate against the EVALUATION CRITERIA above when generating feedback

TRANSCRIPTION:
${transcription}`);

  const scoringGuide = config.callType?.scoring_criteria 
    ? `CUSTOM SCORING WEIGHTS:
${Object.entries(config.callType.scoring_criteria).map(([key, weight]) => `- ${key}: weight ${weight}`).join('\n')}`
    : `SCORING GUIDE (1-10):
- 9-10: Exceptional, textbook execution
- 7-8: Good, minor improvements possible  
- 5-6: Average, noticeable gaps
- 3-4: Below average, significant issues
- 1-2: Poor, major problems`;

  sections.push(`
Return a JSON object with EXACTLY this structure (no markdown, just raw JSON):
{
  "summary": "A concise 2-3 sentence summary capturing the key points of this call. What was discussed? What was the outcome?",
  "memberDetails": {
    "firstName": "string or null - the member's first name if mentioned",
    "lastName": "string or null - the member's last name if mentioned",
    "phoneNumber": "string or null - phone number if mentioned or confirmed (format: xxx-xxx-xxxx)",
    "email": "string or null - email address if mentioned",
    "householdSize": "number or null - how many people will be moving in",
    "weeklyBudget": "number or null - their weekly budget amount in dollars",
    "moveInDate": "string or null - specific move-in date mentioned (e.g., 'December 15' or 'next Monday')",
    "commitmentWeeks": "number or null - how many weeks they plan to stay",
    "preferredPaymentMethod": "string or null - cash, card, etc.",
    "propertyAddress": "string or null - specific property address or listing being discussed"
  },
  "memberConcerns": ["List every concern, worry, hesitation, or question raised by the member"],
  "memberPreferences": ["List ALL preferences mentioned: location, budget, timing, room type, amenities, etc."],
  "recommendedActions": ["Specific follow-up actions for the agent"],
  "objections": ["Any hesitations, pushback, or reasons the member gave for not committing"],
  "moveInReadiness": "high | medium | low",
  "callSentiment": "positive | neutral | negative",
  "agentFeedback": {
    "overallRating": "excellent | good | needs_improvement | poor",
    "strengths": ["Specific things the agent did well, especially related to the evaluation criteria"],
    "improvements": ["Areas to improve, especially missed required criteria or prohibited behaviors"],
    "coachingTips": ["Actionable tips based on the evaluation criteria"],
    "scores": {
      "communication": 7,
      "productKnowledge": 7,
      "objectionHandling": 7,
      "closingSkills": 7
    }
  }
}

${scoringGuide}

IMPORTANT: Even for very short calls, provide meaningful analysis. Reference the evaluation criteria in your feedback.`);

  return sections.join('\n');
}

function buildDefaultAnalysisPrompt(transcription: string): string {
  return `You are an expert at analyzing sales call transcriptions for PadSplit, a housing/rental service.

CRITICAL INSTRUCTIONS:
1. Extract ALL relevant information, even minor mentions
2. If the call is short or limited, still extract what you can
3. NEVER return empty arrays if there's ANY relevant content
4. For short calls (under 2 minutes), adapt your analysis to the available content
5. Be specific - quote or paraphrase actual phrases from the call when possible

TRANSCRIPTION:
${transcription}

Return a JSON object with EXACTLY this structure (no markdown, just raw JSON):
{
  "summary": "A concise 2-3 sentence summary capturing the key points of this call. What was discussed? What was the outcome?",
  "memberDetails": {
    "firstName": "string or null - the member's first name if mentioned",
    "lastName": "string or null - the member's last name if mentioned",
    "phoneNumber": "string or null - phone number if mentioned or confirmed (format: xxx-xxx-xxxx)",
    "email": "string or null - email address if mentioned",
    "householdSize": "number or null - how many people will be moving in",
    "weeklyBudget": "number or null - their weekly budget amount in dollars",
    "moveInDate": "string or null - specific move-in date mentioned (e.g., 'December 15' or 'next Monday')",
    "commitmentWeeks": "number or null - how many weeks they plan to stay",
    "preferredPaymentMethod": "string or null - cash, card, etc.",
    "propertyAddress": "string or null - specific property address or listing being discussed"
  },
  "memberConcerns": ["List every concern, worry, hesitation, or question raised by the member, even minor ones. Example: 'Worried about parking availability', 'Concerned about noise levels'"],
  "memberPreferences": ["List ALL preferences mentioned: location, budget, timing, room type, amenities, etc. Example: 'Prefers ground floor', 'Budget under $800', 'Needs to move by next week'"],
  "recommendedActions": ["Specific follow-up actions for the agent. Example: 'Send listing links for downtown properties', 'Follow up about move-in date confirmation', 'Schedule property tour'"],
  "objections": ["Any hesitations, pushback, or reasons the member gave for not committing. Example: 'Wants to see other options first', 'Price is higher than expected'"],
  "moveInReadiness": "high (ready to move within days, very motivated) | medium (interested but exploring options, flexible timeline) | low (just researching, no urgency)",
  "callSentiment": "positive (member engaged, interested, good rapport) | neutral (standard business conversation) | negative (frustrated, disengaged, complaints)",
  "agentFeedback": {
    "overallRating": "excellent (exceeded expectations) | good (solid performance) | needs_improvement (missed opportunities) | poor (significant issues)",
    "strengths": ["Specific things the agent did well. Quote exact moments when possible. Example: 'Great rapport building when discussing the member's job situation', 'Clearly explained the booking process'"],
    "improvements": ["Specific areas to improve with examples. Example: 'Could have asked more qualifying questions about budget', 'Missed opportunity to address timeline concerns'"],
    "coachingTips": ["Actionable tips. Example: 'Try using open-ended questions to uncover more preferences', 'When member mentions concerns, acknowledge them before moving on'"],
    "scores": {
      "communication": 7,
      "productKnowledge": 7,
      "objectionHandling": 7,
      "closingSkills": 7
    }
  }
}

SCORING GUIDE (1-10):
- 9-10: Exceptional, textbook execution
- 7-8: Good, minor improvements possible  
- 5-6: Average, noticeable gaps
- 3-4: Below average, significant issues
- 1-2: Poor, major problems

IMPORTANT: Even for very short calls, provide meaningful analysis. A 1-minute call checking availability still has extractable insights (member's location interest, timing, urgency level).`;
}

// Retry logic for AI calls
async function callAIWithRetry(
  supabase: any,
  lovableApiKey: string, 
  transcription: string,
  config: CallTypeConfig | null,
  bookingId: string,
  agentId: string | null,
  siteId: string | null,
  maxRetries = 2,
  callDurationSeconds: number | null = null
): Promise<{ keyPoints: any; agentFeedback: any; summary: string }> {
  let lastError: Error | null = null;
  
  // Select model based on call duration (Flash for short calls, Pro for longer)
  const analysisModel = selectAnalysisModel(callDurationSeconds);
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[ReAnalyze] AI attempt ${attempt + 1}/${maxRetries + 1}`);
      
      const prompt = buildDynamicAnalysisPrompt(transcription, config);
      
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: analysisModel,
          messages: [
            { role: 'user', content: prompt }
          ],
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        throw new Error(`AI API error: ${aiResponse.status} - ${errorText}`);
      }

      const aiResult = await aiResponse.json();
      const aiContent = aiResult.choices?.[0]?.message?.content || '';
      
      // Log AI cost on successful call
      if (attempt === 0 || attempt === maxRetries) {
        const inputTokens = Math.ceil(prompt.length / 4);
        const outputTokens = Math.ceil(aiContent.length / 4);
        logApiCost(supabase, {
          service_provider: 'lovable_ai',
          service_type: 'ai_reanalysis',
          edge_function: 'reanalyze-call',
          booking_id: bookingId,
      agent_id: agentId || undefined,
      site_id: siteId || undefined,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          metadata: { model: analysisModel, attempt: attempt + 1, call_duration_seconds: callDurationSeconds }
        });
      }
      
      // Clean and parse JSON
      let cleanedContent = aiContent.trim();
      if (cleanedContent.startsWith('```json')) {
        cleanedContent = cleanedContent.slice(7);
      }
      if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.slice(3);
      }
      if (cleanedContent.endsWith('```')) {
        cleanedContent = cleanedContent.slice(0, -3);
      }
      cleanedContent = cleanedContent.trim();
      
      const parsed = JSON.parse(cleanedContent);
      
      // Validate the response has meaningful content
      const summary = parsed.summary || '';
      if (summary.length < 20 || summary.includes('parsing failed')) {
        throw new Error('AI returned insufficient summary');
      }
      
      const agentFeedback = parsed.agentFeedback || null;
      
      // Validate agent feedback has scores
      if (agentFeedback && (!agentFeedback.scores || typeof agentFeedback.scores.communication !== 'number')) {
        console.log('[ReAnalyze] Warning: Agent feedback missing scores, retrying...');
        if (attempt < maxRetries) {
          throw new Error('Agent feedback missing required scores');
        }
      }
      
      const keyPoints = {
        summary: parsed.summary,
        memberConcerns: parsed.memberConcerns || [],
        memberPreferences: parsed.memberPreferences || [],
        recommendedActions: parsed.recommendedActions || [],
        objections: parsed.objections || [],
        moveInReadiness: parsed.moveInReadiness || 'medium',
        callSentiment: parsed.callSentiment || 'neutral',
        memberDetails: parsed.memberDetails || null
      };
      
      console.log('[ReAnalyze] AI parsing successful:', {
        summaryLength: summary.length,
        concerns: keyPoints.memberConcerns.length,
        preferences: keyPoints.memberPreferences.length,
        hasAgentFeedback: !!agentFeedback
      });
      
      return { keyPoints, agentFeedback, summary };
      
    } catch (error) {
      console.error(`[ReAnalyze] Attempt ${attempt + 1} failed:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }
  
  throw lastError || new Error('AI analysis failed after retries');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingId } = await req.json();
    
    if (!bookingId) {
      throw new Error('Missing bookingId');
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

    console.log(`[ReAnalyze] Starting re-analysis for booking ${bookingId}`);

    // Fetch the existing booking status, call_type_id, and agent info
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('id, transcription_status, call_duration_seconds, call_type_id, agent_id, agents(site_id)')
      .eq('id', bookingId)
      .single();

    if (fetchError || !booking) {
      throw new Error(`Booking not found: ${fetchError?.message || 'Unknown error'}`);
    }

    if (booking.transcription_status !== 'completed') {
      throw new Error('Transcription is not completed yet.');
    }

    const agentId = booking.agent_id || null;
    const siteId = (booking.agents as any)?.site_id || null;

    // Fetch transcription from booking_transcriptions table
    const { data: transcriptionData, error: transcriptionError } = await supabase
      .from('booking_transcriptions')
      .select('call_transcription')
      .eq('booking_id', bookingId)
      .single();

    if (transcriptionError || !transcriptionData?.call_transcription) {
      throw new Error('No transcription found. Please transcribe the call first.');
    }

    console.log(`[ReAnalyze] Found transcription (${transcriptionData.call_transcription.length} chars, ${booking.call_duration_seconds}s duration)`);

    // Fetch call type configuration if available
    const config = await fetchCallTypeConfig(supabase, booking.call_type_id);

    // Re-analyze with dynamic prompt and retry logic
    const { keyPoints, agentFeedback, summary } = await callAIWithRetry(
      supabase,
      lovableApiKey,
      transcriptionData.call_transcription,
      config,
      bookingId,
      agentId,
      siteId,
      2, // maxRetries
      booking.call_duration_seconds // Pass duration for model selection
    );

    // Update booking_transcriptions with new analysis
    console.log('[ReAnalyze] Updating booking_transcriptions with new analysis...');
    const { error: updateError } = await supabase
      .from('booking_transcriptions')
      .update({
        call_summary: summary,
        call_key_points: keyPoints,
        agent_feedback: agentFeedback,
        updated_at: new Date().toISOString(),
      })
      .eq('booking_id', bookingId);

    if (updateError) {
      console.error('[ReAnalyze] Update error:', updateError);
      throw new Error(`Failed to update booking: ${updateError.message}`);
    }

    console.log(`[ReAnalyze] Successfully re-analyzed booking ${bookingId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Call re-analyzed successfully',
        bookingId,
        keyPoints,
        agentFeedback,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ReAnalyze] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
