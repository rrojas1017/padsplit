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
    // Fetch call type details
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

    // Fetch company knowledge for this call type
    const { data: knowledge, error: knowledgeError } = await supabase
      .from('company_knowledge')
      .select('title, content, category')
      .eq('is_active', true)
      .contains('call_type_ids', [callTypeId])
      .order('priority', { ascending: false });

    if (knowledgeError) {
      console.log('[Config] Error fetching knowledge:', knowledgeError);
    }

    // Fetch rules for this call type
    const { data: rules, error: rulesError } = await supabase
      .from('call_type_rules')
      .select('rule_name, rule_type, rule_description, ai_instruction, weight')
      .eq('call_type_id', callTypeId)
      .eq('is_active', true)
      .order('weight', { ascending: false });

    if (rulesError) {
      console.log('[Config] Error fetching rules:', rulesError);
    }

    // Fetch script template for this call type
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

// Build dynamic coaching prompt based on configuration
function buildDynamicCoachingPrompt(transcription: string, config: CallTypeConfig | null): string {
  // Default prompt if no config
  if (!config) {
    return buildDefaultCoachingPrompt(transcription);
  }

  const sections: string[] = [];

  // Header with call type context
  sections.push(`You are an expert at analyzing sales call transcriptions for a housing/rental service called PadSplit.
This is a "${config.callType?.name || 'General'}" call type.`);

  // Analysis focus from call type
  if (config.callType?.analysis_focus) {
    sections.push(`
ANALYSIS FOCUS:
${config.callType.analysis_focus}`);
  }

  // Company knowledge context
  if (config.knowledge.length > 0) {
    sections.push(`
COMPANY KNOWLEDGE (use this context when evaluating):
${config.knowledge.map(k => `
[${k.category.toUpperCase()}] ${k.title}:
${k.content}`).join('\n')}`);
  }

  // Evaluation rules grouped by type
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

  // Script adherence if script exists
  if (config.script) {
    sections.push(`
SCRIPT TEMPLATE (evaluate adherence):
Script: "${config.script.name}"
${config.script.script_content}

Note: Agent should follow the general structure and key talking points.`);
  }

  // Transcription and output format
  sections.push(`
Analyze this call transcription and provide detailed agent performance feedback in JSON format.

TRANSCRIPTION:
${transcription}`);

  // Custom scoring if defined
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
Return a JSON object with EXACTLY this structure (no markdown, just JSON):
{
  "agentFeedback": {
    "overallRating": "excellent" or "good" or "needs_improvement" or "poor",
    "strengths": ["Array of things the agent did well, especially related to evaluation criteria"],
    "improvements": ["Array of specific areas where the agent could improve, especially missed required criteria"],
    "coachingTips": ["Array of actionable coaching tips based on evaluation criteria"],
    "scores": {
      "communication": 1-10 score for clarity, active listening, and rapport building,
      "productKnowledge": 1-10 score for PadSplit knowledge and ability to answer questions,
      "objectionHandling": 1-10 score for addressing concerns and objections effectively,
      "closingSkills": 1-10 score for guiding the conversation toward booking/next steps
    }
  }
}

${scoringGuide}

If a category has no relevant information, return an empty array [].
For agent feedback, be specific and constructive - mention exact phrases or moments from the call when possible.
Reference the evaluation criteria in your feedback.`);

  return sections.join('\n');
}

// Default coaching prompt for calls without call type configuration
function buildDefaultCoachingPrompt(transcription: string): string {
  return `You are an expert at analyzing sales call transcriptions for a housing/rental service called PadSplit.
    
Analyze this call transcription and provide detailed agent performance feedback in JSON format.

TRANSCRIPTION:
${transcription}

Return a JSON object with EXACTLY this structure (no markdown, just JSON):
{
  "agentFeedback": {
    "overallRating": "excellent" or "good" or "needs_improvement" or "poor",
    "strengths": ["Array of things the agent did well on this call"],
    "improvements": ["Array of specific areas where the agent could improve"],
    "coachingTips": ["Array of actionable coaching tips for the agent based on this call"],
    "scores": {
      "communication": 1-10 score for clarity, active listening, and rapport building,
      "productKnowledge": 1-10 score for PadSplit knowledge and ability to answer questions,
      "objectionHandling": 1-10 score for addressing concerns and objections effectively,
      "closingSkills": 1-10 score for guiding the conversation toward booking/next steps
    }
  }
}

If a category has no relevant information, return an empty array [].
For agent feedback, be specific and constructive - mention exact phrases or moments from the call when possible.`;
}

serve(async (req) => {
  // Handle CORS preflight
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

    console.log(`Regenerating coaching for booking ${bookingId}`);

    // Fetch the existing booking with transcription and call_type_id
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('id, call_transcription, transcription_status, call_type_id')
      .eq('id', bookingId)
      .single();

    if (fetchError || !booking) {
      throw new Error(`Booking not found: ${fetchError?.message || 'Unknown error'}`);
    }

    if (!booking.call_transcription) {
      throw new Error('No transcription found for this booking. Please transcribe the call first.');
    }

    if (booking.transcription_status !== 'completed') {
      throw new Error('Transcription is not completed yet.');
    }

    // Fetch call type configuration if available
    const config = await fetchCallTypeConfig(supabase, booking.call_type_id);

    // Generate agent feedback with dynamic prompt
    console.log('Generating AI agent feedback...');
    const feedbackPrompt = buildDynamicCoachingPrompt(booking.call_transcription, config);

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'user', content: feedbackPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Lovable AI error:', errorText);
      throw new Error(`AI feedback error: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    const aiContent = aiResult.choices?.[0]?.message?.content || '';
    console.log('AI response received');

    // Parse the JSON response
    let agentFeedback = null;
    try {
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
      agentFeedback = parsed.agentFeedback || null;
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      throw new Error('Failed to parse AI response for coaching feedback');
    }

    if (!agentFeedback) {
      throw new Error('AI did not return valid agent feedback');
    }

    // Update the booking with agent feedback
    console.log('Updating booking with agent feedback...');
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        agent_feedback: agentFeedback,
      })
      .eq('id', bookingId);

    if (updateError) {
      console.error('Update error:', updateError);
      throw new Error(`Failed to update booking: ${updateError.message}`);
    }

    console.log(`Coaching regenerated successfully for booking ${bookingId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Coaching feedback regenerated',
        bookingId,
        agentFeedback,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error regenerating coaching:', error);
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
