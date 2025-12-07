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
  service_provider: 'elevenlabs' | 'deepgram' | 'lovable_ai';
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
      // STT: ~$0.10 per minute
      if (params.audio_duration_seconds) {
        cost = (params.audio_duration_seconds / 60) * 0.10;
      }
      // TTS: ~$0.30 per 1000 characters
      if (params.character_count) {
        cost = params.character_count * 0.0003;
      }
    } else if (params.service_provider === 'deepgram') {
      // Deepgram Nova-2 batch: ~$0.0043 per minute
      if (params.audio_duration_seconds) {
        cost = (params.audio_duration_seconds / 60) * 0.0043;
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

// Determine which STT provider to use based on day of month
// Odd days = ElevenLabs, Even days = Deepgram
function getSTTProvider(): 'elevenlabs' | 'deepgram' {
  const dayOfMonth = new Date().getDate();
  return dayOfMonth % 2 === 0 ? 'deepgram' : 'elevenlabs';
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
  const deepgramApiKey = Deno.env.get('DEEPGRAM_API_KEY');
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  // Determine which provider to use today
  const sttProvider = getSTTProvider();
  console.log(`[Background] Using STT provider: ${sttProvider} (day ${new Date().getDate()})`);
  
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

    // Step 2: Transcribe with selected STT provider
    let transcription = '';
    let callDurationSeconds: number | null = null;
    
    if (sttProvider === 'deepgram' && deepgramApiKey) {
      // ========== DEEPGRAM NOVA-2 TRANSCRIPTION ==========
      console.log('[Background] Sending to Deepgram Nova-2...');
      
      const deepgramResponse = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&diarize=true&punctuate=true&language=en', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${deepgramApiKey}`,
          'Content-Type': 'audio/wav',
        },
        body: audioBlob,
      });

      if (!deepgramResponse.ok) {
        const errorText = await deepgramResponse.text();
        console.error('[Background] Deepgram API error:', errorText);
        throw new Error(`Deepgram API error: ${deepgramResponse.status}`);
      }

      const deepgramResult = await deepgramResponse.json();
      console.log('[Background] Deepgram response received');

      // Extract duration from Deepgram response
      if (deepgramResult.metadata?.duration) {
        callDurationSeconds = Math.ceil(deepgramResult.metadata.duration);
        const mins = Math.floor(callDurationSeconds / 60);
        const secs = callDurationSeconds % 60;
        console.log(`[Background] Call duration: ${callDurationSeconds} seconds (${mins}:${secs.toString().padStart(2, '0')})`);
      }

      // Format Deepgram transcription with speaker labels (normalized to match ElevenLabs output)
      const words = deepgramResult.results?.channels?.[0]?.alternatives?.[0]?.words || [];
      if (words.length > 0) {
        const formattedSegments: string[] = [];
        let currentSpeaker = -1;
        let currentText = '';
        
        for (const word of words) {
          const speaker = word.speaker ?? 0;
          
          if (speaker !== currentSpeaker) {
            if (currentText.trim()) {
              const speakerLabel = currentSpeaker === 0 ? 'Agent' : 'Member';
              formattedSegments.push(`${speakerLabel}: ${currentText.trim()}`);
            }
            currentSpeaker = speaker;
            currentText = word.punctuated_word || word.word || '';
            currentText += ' ';
          } else {
            currentText += (word.punctuated_word || word.word || '') + ' ';
          }
        }
        
        if (currentText.trim()) {
          const speakerLabel = currentSpeaker === 0 ? 'Agent' : 'Member';
          formattedSegments.push(`${speakerLabel}: ${currentText.trim()}`);
        }
        
        transcription = formattedSegments.length > 0 
          ? formattedSegments.join('\n\n') 
          : deepgramResult.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
      } else {
        transcription = deepgramResult.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
      }
      
      console.log('[Background] Deepgram transcription complete, length:', transcription.length);

      // Log Deepgram STT cost
      if (callDurationSeconds) {
        logApiCost(supabase, {
          service_provider: 'deepgram',
          service_type: 'stt_transcription',
          edge_function: 'transcribe-call',
          booking_id: bookingId,
          agent_id: agentId || undefined,
          site_id: siteId || undefined,
          audio_duration_seconds: callDurationSeconds,
          metadata: { model: 'nova-2', file_size_mb: fileSizeMB }
        });
      }
    } else {
      // ========== ELEVENLABS SCRIBE TRANSCRIPTION (default/fallback) ==========
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
        throw new Error(`ElevenLabs API error: ${elevenLabsResponse.status}`);
      }

      const elevenLabsResult = await elevenLabsResponse.json();
      console.log('[Background] ElevenLabs response received');

      // Format transcription with speaker labels
      transcription = elevenLabsResult.text || '';
      
      if (elevenLabsResult.words && elevenLabsResult.words.length > 0) {
        const lastWord = elevenLabsResult.words[elevenLabsResult.words.length - 1];
        if (lastWord.end) {
          callDurationSeconds = Math.ceil(lastWord.end);
          const mins = Math.floor(callDurationSeconds / 60);
          const secs = callDurationSeconds % 60;
          console.log(`[Background] Call duration: ${callDurationSeconds} seconds (${mins}:${secs.toString().padStart(2, '0')})`);
        }

        const formattedSegments: string[] = [];
        let currentSpeaker = '';
        let currentText = '';
        
        for (const word of elevenLabsResult.words) {
          const speaker = word.speaker_id || 'Unknown';
          
          if (speaker !== currentSpeaker) {
            if (currentText.trim()) {
              const speakerLabel = currentSpeaker === 'speaker_0' ? 'Agent' : 
                                  currentSpeaker === 'speaker_1' ? 'Member' : currentSpeaker;
              formattedSegments.push(`${speakerLabel}: ${currentText.trim()}`);
            }
            currentSpeaker = speaker;
            currentText = word.text + ' ';
          } else {
            currentText += word.text + ' ';
          }
        }
        
        if (currentText.trim()) {
          const speakerLabel = currentSpeaker === 'speaker_0' ? 'Agent' : 
                              currentSpeaker === 'speaker_1' ? 'Member' : currentSpeaker;
          formattedSegments.push(`${speakerLabel}: ${currentText.trim()}`);
        }
        
        if (formattedSegments.length > 0) {
          transcription = formattedSegments.join('\n\n');
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
        stt_provider: sttProvider,
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

  } catch (error) {
    // Clear timeout on error
    clearTimeout(timeoutId);
    console.error(`[Background] Transcription failed for booking ${bookingId}:`, error);
    
    // Update status to failed
    try {
      await supabase
        .from('bookings')
        .update({ transcription_status: 'failed' })
        .eq('id', bookingId);
      console.log(`[Background] Status updated to failed for booking ${bookingId}`);
    } catch (e) {
      console.error('[Background] Failed to update status to failed:', e);
    }
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
