import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Declare EdgeRuntime for background tasks
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cost logging helper function
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
      // Pro Plan rates (credits-based, ~$99/mo for 500k credits)
      // STT: ~$0.034 per minute (Pro Plan)
      if (params.audio_duration_seconds) {
        cost = (params.audio_duration_seconds / 60) * 0.034;
      }
      // TTS: ~$0.15 per 1000 characters (Pro Plan)
      if (params.character_count) {
        cost = params.character_count * 0.00015;
      }
    } else if (params.service_provider === 'lovable_ai') {
      // Gemini Flash: ~$0.0001 per 1K input, ~$0.0003 per 1K output
      const inputCost = ((params.input_tokens || 0) / 1000) * 0.0001;
      const outputCost = ((params.output_tokens || 0) / 1000) * 0.0003;
      cost = inputCost + outputCost;
    }

    await supabase.from('api_costs').insert({
      service_provider: params.service_provider,
      service_type: params.service_type,
      edge_function: params.edge_function,
      booking_id: params.booking_id || null,
      agent_id: params.agent_id || null,
      site_id: params.site_id || null,
      input_tokens: params.input_tokens || null,
      output_tokens: params.output_tokens || null,
      audio_duration_seconds: params.audio_duration_seconds || null,
      character_count: params.character_count || null,
      estimated_cost_usd: cost,
      metadata: params.metadata || {}
    });
    
    console.log(`[Cost] Logged ${params.service_provider} ${params.service_type}: $${cost.toFixed(6)}`);
  } catch (error) {
    // Don't fail the main operation if cost logging fails
    console.error('[Cost] Failed to log API cost:', error);
  }
}

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

// Build dynamic prompt based on configuration
function buildDynamicPrompt(transcription: string, config: CallTypeConfig | null): string {
  // Default prompt if no config
  if (!config) {
    return buildDefaultPrompt(transcription);
  }

  const sections: string[] = [];

  // Header with call type context
  sections.push(`You are an expert at analyzing sales call transcriptions for PadSplit, a housing/rental service.
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
COMPANY KNOWLEDGE (use this context when analyzing):
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

Note: Agent should follow the general structure and key talking points. Minor deviations are acceptable if the conversation flows naturally.`);
  }

  // Core instructions
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

  // Output format with custom scoring if defined
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

// Default prompt for calls without call type configuration
function buildDefaultPrompt(transcription: string): string {
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

// AI-based speaker identification to correctly label Agent vs Member
async function identifySpeakers(
  rawTranscript: string,
  lovableApiKey: string
): Promise<{ speaker_0: string; speaker_1: string; confidence: string }> {
  console.log('[Speaker ID] Starting AI-based speaker identification...');
  
  const prompt = `Analyze this call transcript between a PadSplit sales agent and a prospective member.

CONTEXT: PadSplit is a housing/room rental service. The Agent works for PadSplit and helps people find rooms. The Member is looking for housing.

AGENT INDICATORS (person who works for PadSplit):
- Introduces themselves with name/company ("Hi, this is X from PadSplit", "Thank you for calling PadSplit")
- Asks qualifying questions (budget, move-in date, household size, employment)
- Offers to help, look up listings, send information
- Uses professional language and call handling phrases ("How can I help you today?")
- Provides information about PadSplit services/process/policies
- Confirms availability, pricing, or property details
- Guides the conversation structure

MEMBER INDICATORS (person looking for housing):
- Looking for housing/rooms/apartments ("I'm looking for a place", "I need a room")
- Asks about prices, availability, locations, amenities
- Shares personal details when asked (budget, timeline, family size, job)
- May express concerns or objections about moving
- Generally responds to questions rather than leading the conversation
- Discusses their current living situation or reasons for moving

TRANSCRIPT (first portion):
${rawTranscript.substring(0, 3000)}

Based on the conversation patterns above, identify which speaker is the Agent (PadSplit employee).

CRITICAL: Look at WHO is asking qualifying questions vs WHO is answering them. The Agent ASKS, the Member ANSWERS.

Return ONLY a JSON object (no markdown, no explanation):
{
  "speaker_0": "Agent" or "Member",
  "speaker_1": "Agent" or "Member",
  "confidence": "high" or "medium" or "low",
  "reason": "Brief explanation"
}`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite', // Fast, cheap model for this task
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      console.error('[Speaker ID] AI request failed:', response.status);
      return { speaker_0: 'Agent', speaker_1: 'Member', confidence: 'fallback' };
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';
    
    // Parse the JSON response
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```json')) cleanedContent = cleanedContent.slice(7);
    if (cleanedContent.startsWith('```')) cleanedContent = cleanedContent.slice(3);
    if (cleanedContent.endsWith('```')) cleanedContent = cleanedContent.slice(0, -3);
    cleanedContent = cleanedContent.trim();
    
    const parsed = JSON.parse(cleanedContent);
    
    // Validate the response
    if (parsed.speaker_0 && parsed.speaker_1) {
      console.log(`[Speaker ID] Identified: speaker_0=${parsed.speaker_0}, speaker_1=${parsed.speaker_1}, confidence=${parsed.confidence}`);
      console.log(`[Speaker ID] Reason: ${parsed.reason || 'not provided'}`);
      return {
        speaker_0: parsed.speaker_0,
        speaker_1: parsed.speaker_1,
        confidence: parsed.confidence || 'medium'
      };
    }
    
    throw new Error('Invalid speaker identification response');
  } catch (error) {
    console.error('[Speaker ID] Error identifying speakers:', error);
    // Fallback to original assumption
    return { speaker_0: 'Agent', speaker_1: 'Member', confidence: 'fallback' };
  }
}

// Format raw transcript with generic labels for speaker identification
function formatRawTranscript(words: any[]): string {
  const segments: string[] = [];
  let currentSpeaker = '';
  let currentText = '';
  
  for (const word of words) {
    const speaker = word.speaker_id || 'Unknown';
    
    if (speaker !== currentSpeaker) {
      if (currentText.trim()) {
        segments.push(`${currentSpeaker}: ${currentText.trim()}`);
      }
      currentSpeaker = speaker;
      currentText = word.text + ' ';
    } else {
      currentText += word.text + ' ';
    }
  }
  
  if (currentText.trim()) {
    segments.push(`${currentSpeaker}: ${currentText.trim()}`);
  }
  
  return segments.join('\n\n');
}

// Apply correct speaker labels based on AI identification
function applyCorrectLabels(
  words: any[],
  speakerMapping: { speaker_0: string; speaker_1: string }
): string {
  const segments: string[] = [];
  let currentSpeaker = '';
  let currentText = '';
  
  for (const word of words) {
    const rawSpeaker = word.speaker_id || 'Unknown';
    
    if (rawSpeaker !== currentSpeaker) {
      if (currentText.trim()) {
        // Map speaker_0/speaker_1 to Agent/Member based on AI identification
        let label = currentSpeaker;
        if (currentSpeaker === 'speaker_0') {
          label = speakerMapping.speaker_0;
        } else if (currentSpeaker === 'speaker_1') {
          label = speakerMapping.speaker_1;
        }
        segments.push(`${label}: ${currentText.trim()}`);
      }
      currentSpeaker = rawSpeaker;
      currentText = word.text + ' ';
    } else {
      currentText += word.text + ' ';
    }
  }
  
  if (currentText.trim()) {
    let label = currentSpeaker;
    if (currentSpeaker === 'speaker_0') {
      label = speakerMapping.speaker_0;
    } else if (currentSpeaker === 'speaker_1') {
      label = speakerMapping.speaker_1;
    }
    segments.push(`${label}: ${currentText.trim()}`);
  }
  
  return segments.join('\n\n');
}

// Helper to update booking with error message
async function updateBookingError(supabase: any, bookingId: string, errorMessage: string) {
  try {
    await supabase
      .from('bookings')
      .update({ 
        transcription_status: 'failed',
        transcription_error_message: errorMessage 
      })
      .eq('id', bookingId);
  } catch (e) {
    console.error('[Background] Failed to update error status:', e);
  }
}

// Background transcription processing with timeout handling
async function processTranscription(bookingId: string, kixieUrl: string) {
  console.log(`[Background] Starting transcription for booking ${bookingId}`);
  
  const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  const supabase = createClient(supabaseUrl!, supabaseServiceKey!);
  
  // Set a timeout to mark as failed if processing takes too long (5 minutes)
  const TIMEOUT_MS = 5 * 60 * 1000;
  const timeoutId = setTimeout(async () => {
    console.error(`[Background] Transcription timeout for booking ${bookingId} after 5 minutes`);
    await updateBookingError(supabase, bookingId, 'Processing timeout - the audio file may be too large or the service is busy. Please try again.');
  }, TIMEOUT_MS);

  // Variables to track for cost logging
  let agentId: string | null = null;
  let siteId: string | null = null;

  try {
    // Update status to processing (clear any previous error)
    await supabase
      .from('bookings')
      .update({ 
        transcription_status: 'processing',
        transcription_error_message: null 
      })
      .eq('id', bookingId);

    // Fetch booking to get call_type_id, agent_id, and site_id
    const { data: bookingData, error: bookingError } = await supabase
      .from('bookings')
      .select('call_type_id, agent_id, agents(site_id)')
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingError) {
      console.log('[Background] Error fetching booking:', bookingError);
    }

    const callTypeId = bookingData?.call_type_id || null;
    agentId = bookingData?.agent_id || null;
    siteId = (bookingData?.agents as any)?.site_id || null;
    console.log(`[Background] Booking call_type_id: ${callTypeId || 'none'}, agent_id: ${agentId}, site_id: ${siteId}`);

    // Fetch call type configuration if available
    const config = await fetchCallTypeConfig(supabase, callTypeId);

    // Step 1: Download the audio file with detailed error handling
    console.log('[Background] Downloading audio file...');
    console.log('[Background] Audio URL:', kixieUrl.substring(0, 80) + '...');
    
    let audioResponse;
    try {
      audioResponse = await fetch(kixieUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Lovable/1.0)',
        },
      });
    } catch (fetchError) {
      const errorMsg = fetchError instanceof Error ? fetchError.message : 'Unknown network error';
      console.error('[Background] Audio download network error:', errorMsg);
      clearTimeout(timeoutId);
      await updateBookingError(supabase, bookingId, `Audio download failed: ${errorMsg}. The recording link may be invalid or expired.`);
      return;
    }

    if (!audioResponse.ok) {
      const statusText = audioResponse.statusText || 'Unknown error';
      console.error(`[Background] Audio download failed: ${audioResponse.status} ${statusText}`);
      clearTimeout(timeoutId);
      
      let errorMessage = '';
      if (audioResponse.status === 404) {
        errorMessage = 'Audio file not found (404). The recording may have been deleted or the link is invalid.';
      } else if (audioResponse.status === 403) {
        errorMessage = 'Access denied to audio file (403). The recording link may have expired.';
      } else if (audioResponse.status === 401) {
        errorMessage = 'Authentication required for audio file (401). The recording link may have expired.';
      } else if (audioResponse.status >= 500) {
        errorMessage = `Recording server error (${audioResponse.status}). Please try again later.`;
      } else {
        errorMessage = `Failed to download audio: ${audioResponse.status} ${statusText}`;
      }
      
      await updateBookingError(supabase, bookingId, errorMessage);
      return;
    }
    
    const audioBlob = await audioResponse.blob();
    const fileSizeMB = audioBlob.size / (1024 * 1024);
    console.log(`[Background] Audio downloaded, size: ${audioBlob.size} bytes (${fileSizeMB.toFixed(2)} MB)`);
    
    // Check if audio file is valid (not empty or too small)
    if (audioBlob.size < 1000) {
      console.error('[Background] Audio file too small, likely invalid');
      clearTimeout(timeoutId);
      await updateBookingError(supabase, bookingId, 'Audio file is empty or corrupted. The recording may not have been saved properly.');
      return;
    }

    // Step 2: Transcribe with ElevenLabs
    let transcription = '';
    let callDurationSeconds: number | null = null;
    
    console.log('[Background] Sending to ElevenLabs Speech-to-Text...');
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.wav');
    formData.append('model_id', 'scribe_v1');
    formData.append('diarize', 'true');
    formData.append('language_code', 'eng');
    formData.append('tag_audio_events', 'true');

    const elevenLabsResponse = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': elevenLabsApiKey!,
      },
      body: formData,
    });

if (!elevenLabsResponse.ok) {
      const errorText = await elevenLabsResponse.text();
      console.error('[Background] ElevenLabs API error:', errorText);
      
      // Parse error for specific handling
      let errorDetails: any = {};
      try {
        errorDetails = JSON.parse(errorText);
      } catch { /* ignore parse errors */ }
      
      const status = errorDetails?.detail?.status;
      const message = errorDetails?.detail?.message || errorText;
      
      // Detect billing/payment issues
      if (status === 'payment_issue' || elevenLabsResponse.status === 402) {
        console.error('[BILLING ALERT] ElevenLabs payment issue detected:', message);
        
        // Create admin notification (avoid duplicates)
        const { data: existing } = await supabase
          .from('admin_notifications')
          .select('id')
          .eq('notification_type', 'billing_alert')
          .eq('service', 'elevenlabs')
          .eq('is_resolved', false)
          .limit(1);
          
        if (!existing || existing.length === 0) {
          await supabase.from('admin_notifications').insert({
            notification_type: 'billing_alert',
            service: 'elevenlabs',
            title: 'ElevenLabs Payment Issue',
            message: `Transcriptions are failing due to a billing problem: ${message}`,
            severity: 'critical',
            metadata: { status, booking_id: bookingId, raw_error: errorText.substring(0, 500) }
          });
          console.log('[Billing Alert] Created critical notification for ElevenLabs payment issue');
        }
        
        await updateBookingError(supabase, bookingId, `ElevenLabs billing issue: ${message}. Please check your ElevenLabs subscription.`);
        return;
      }
      
      // Detect quota exceeded
      if (status === 'quota_exceeded' || message.toLowerCase().includes('quota')) {
        console.error('[QUOTA ALERT] ElevenLabs usage limit reached:', message);
        
        const { data: existing } = await supabase
          .from('admin_notifications')
          .select('id')
          .eq('notification_type', 'billing_alert')
          .eq('service', 'elevenlabs')
          .eq('title', 'ElevenLabs Quota Exceeded')
          .eq('is_resolved', false)
          .limit(1);
          
        if (!existing || existing.length === 0) {
          await supabase.from('admin_notifications').insert({
            notification_type: 'billing_alert',
            service: 'elevenlabs',
            title: 'ElevenLabs Quota Exceeded',
            message: `Character/usage quota has been exceeded: ${message}`,
            severity: 'warning',
            metadata: { status, booking_id: bookingId }
          });
          console.log('[Billing Alert] Created warning notification for ElevenLabs quota exceeded');
        }
        
        await updateBookingError(supabase, bookingId, `ElevenLabs quota exceeded: ${message}`);
        return;
      }
      
      throw new Error(`ElevenLabs API error: ${elevenLabsResponse.status} - ${message}`);
    }

    const elevenLabsResult = await elevenLabsResponse.json();
    console.log('[Background] ElevenLabs response received');

    // Format transcription with AI-based speaker identification
    transcription = elevenLabsResult.text || '';
    
    if (elevenLabsResult.words && elevenLabsResult.words.length > 0) {
      const lastWord = elevenLabsResult.words[elevenLabsResult.words.length - 1];
      if (lastWord.end) {
        callDurationSeconds = Math.ceil(lastWord.end);
        const mins = Math.floor(callDurationSeconds / 60);
        const secs = callDurationSeconds % 60;
        console.log(`[Background] Call duration: ${callDurationSeconds} seconds (${mins}:${secs.toString().padStart(2, '0')})`);
      }

      // Phase 1: Format raw transcript with generic speaker labels
      const rawTranscript = formatRawTranscript(elevenLabsResult.words);
      
      // Phase 2: Use AI to identify which speaker is Agent vs Member
      const speakerMapping = await identifySpeakers(rawTranscript, lovableApiKey!);
      
      // Log cost for speaker identification (small AI call)
      const speakerIdInputTokens = Math.ceil(3000 / 4); // ~3000 chars prompt
      const speakerIdOutputTokens = Math.ceil(150 / 4); // ~150 chars response
      logApiCost(supabase, {
        service_provider: 'lovable_ai',
        service_type: 'speaker_identification',
        edge_function: 'transcribe-call',
        booking_id: bookingId,
        agent_id: agentId || undefined,
        site_id: siteId || undefined,
        input_tokens: speakerIdInputTokens,
        output_tokens: speakerIdOutputTokens,
        metadata: { 
          model: 'google/gemini-2.5-flash-lite', 
          confidence: speakerMapping.confidence,
          speaker_0: speakerMapping.speaker_0,
          speaker_1: speakerMapping.speaker_1
        }
      });
      
      // Phase 3: Apply correct labels based on AI identification
      transcription = applyCorrectLabels(elevenLabsResult.words, speakerMapping);
      
      if (speakerMapping.confidence === 'fallback') {
        console.log('[Background] Warning: Speaker identification failed, using fallback assumption');
      }
    }
    
    console.log('[Background] ElevenLabs transcription complete, length:', transcription.length);

    // Log ElevenLabs STT cost
    if (callDurationSeconds) {
      logApiCost(supabase, {
        service_provider: 'elevenlabs',
        service_type: 'stt_transcription',
        edge_function: 'transcribe-call',
        booking_id: bookingId,
        agent_id: agentId || undefined,
        site_id: siteId || undefined,
        audio_duration_seconds: callDurationSeconds,
        metadata: { model: 'scribe_v1', file_size_mb: fileSizeMB }
      });
    }
    // Step 3: Generate summary, key points, and agent feedback with dynamic prompt
    console.log('[Background] Generating AI summary and agent feedback...');
    const summaryPrompt = buildDynamicPrompt(transcription, config);

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'user', content: summaryPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[Background] Lovable AI error:', errorText);
      throw new Error(`AI summary error: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    const aiContent = aiResult.choices?.[0]?.message?.content || '';
    console.log('[Background] AI response received');

    // Log Lovable AI cost (estimate tokens from content length)
    const estimatedInputTokens = Math.ceil(summaryPrompt.length / 4);
    const estimatedOutputTokens = Math.ceil(aiContent.length / 4);
    logApiCost(supabase, {
      service_provider: 'lovable_ai',
      service_type: 'ai_analysis',
      edge_function: 'transcribe-call',
      booking_id: bookingId,
      agent_id: agentId || undefined,
      site_id: siteId || undefined,
      input_tokens: estimatedInputTokens,
      output_tokens: estimatedOutputTokens,
      metadata: { model: 'google/gemini-2.5-flash', transcription_length: transcription.length }
    });

    // Parse the JSON response
    let keyPoints;
    let agentFeedback;
    let summary = '';
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
      summary = parsed.summary || '';
      agentFeedback = parsed.agentFeedback || null;
      
      // Extract keyPoints without agentFeedback
      keyPoints = {
        summary: parsed.summary,
        memberConcerns: parsed.memberConcerns || [],
        memberPreferences: parsed.memberPreferences || [],
        recommendedActions: parsed.recommendedActions || [],
        objections: parsed.objections || [],
        moveInReadiness: parsed.moveInReadiness || 'medium',
        callSentiment: parsed.callSentiment || 'neutral',
        memberDetails: parsed.memberDetails || null
      };
    } catch (parseError) {
      console.error('[Background] Failed to parse AI response:', parseError);
      keyPoints = {
        summary: 'Call transcription completed but AI summary parsing failed.',
        memberConcerns: [],
        memberPreferences: [],
        recommendedActions: ['Review transcription manually'],
        objections: [],
        moveInReadiness: 'medium',
        callSentiment: 'neutral'
      };
      agentFeedback = null;
      summary = keyPoints.summary;
    }

    // Step 4: Update the booking status and insert transcription data to separate table
    console.log('[Background] Updating booking status and inserting transcription data...');
    
    // First update the booking status (light data stays in bookings table)
    const { error: bookingUpdateError } = await supabase
      .from('bookings')
      .update({
        transcription_status: 'completed',
        transcribed_at: new Date().toISOString(),
        call_duration_seconds: callDurationSeconds,
      })
      .eq('id', bookingId);

    if (bookingUpdateError) {
      console.error('[Background] Booking update error:', bookingUpdateError);
      throw new Error(`Failed to update booking: ${bookingUpdateError.message}`);
    }

    // Then upsert the heavy data to booking_transcriptions table
    const { error: transcriptionError } = await supabase
      .from('booking_transcriptions')
      .upsert({
        booking_id: bookingId,
        call_transcription: transcription,
        call_summary: summary,
        call_key_points: keyPoints,
        agent_feedback: agentFeedback,
        stt_provider: 'elevenlabs',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'booking_id'
      });

    if (transcriptionError) {
      console.error('[Background] Transcription insert error:', transcriptionError);
      throw new Error(`Failed to save transcription: ${transcriptionError.message}`);
    }

    // Clear timeout on success
    clearTimeout(timeoutId);
    console.log(`[Background] Transcription completed successfully for booking ${bookingId}`);

    // ===== AUTO-GENERATE QA SCORES AND COACHING AUDIO =====
    console.log(`[Background] Triggering automatic QA scoring and coaching generation...`);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Fire-and-forget: Generate Jeff's coaching audio (uses agent_feedback from transcription)
    fetch(`${supabaseUrl}/functions/v1/generate-coaching-audio`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ bookingId }),
    }).then(res => {
      if (res.ok) console.log(`[Background] Jeff coaching audio triggered for ${bookingId}`);
      else console.error(`[Background] Jeff coaching failed: ${res.status}`);
    }).catch(err => console.error('[Background] Jeff coaching error:', err));

    // QA scoring then Katty's QA coaching (sequential because Katty needs QA scores)
    (async () => {
      try {
        // Step 1: Generate QA scores
        const qaResponse = await fetch(`${supabaseUrl}/functions/v1/generate-qa-scores`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ bookingId }),
        });
        
        if (qaResponse.ok) {
          console.log(`[Background] QA scores generated for ${bookingId}`);
          
          // Step 2: Generate Katty's QA coaching audio (needs QA scores)
          const kattyResponse = await fetch(`${supabaseUrl}/functions/v1/generate-qa-coaching-audio`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ bookingId }),
          });
          
          if (kattyResponse.ok) {
            console.log(`[Background] Katty QA coaching audio generated for ${bookingId}`);
          } else {
            console.error(`[Background] Katty coaching failed: ${kattyResponse.status}`);
          }
        } else {
          console.error(`[Background] QA scoring failed: ${qaResponse.status}`);
        }
      } catch (error) {
        console.error('[Background] Auto QA/Katty pipeline error:', error);
      }
    })();

    console.log(`[Background] All automation triggers dispatched for booking ${bookingId}`);

  } catch (error) {
    // Clear timeout on error
    clearTimeout(timeoutId);
    const errorMessage = error instanceof Error ? error.message : 'Unknown transcription error';
    console.error(`[Background] Transcription failed for booking ${bookingId}:`, errorMessage);
    
    // Update status to failed WITH error message for debugging
    await updateBookingError(supabase, bookingId, errorMessage);
    console.log(`[Background] Status updated to failed for booking ${bookingId} with error: ${errorMessage}`);
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingId, kixieUrl } = await req.json();
    
    if (!bookingId || !kixieUrl) {
      throw new Error('Missing bookingId or kixieUrl');
    }

    // Validate required env vars before starting
    const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    if (!elevenLabsApiKey) {
      throw new Error('ELEVENLABS_API_KEY not configured');
    }
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log(`Received transcription request for booking ${bookingId}`);

    // Fire-and-forget: Start background task
    EdgeRuntime.waitUntil(processTranscription(bookingId, kixieUrl));

    // Return immediately
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Transcription started',
        bookingId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error starting transcription:', error);
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
