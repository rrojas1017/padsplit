import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      // STT: ~$0.10 per minute
      if (params.audio_duration_seconds) {
        cost = (params.audio_duration_seconds / 60) * 0.10;
      }
      // TTS: ~$0.30 per 1000 characters
      if (params.character_count) {
        cost = params.character_count * 0.0003;
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

interface QACategory {
  name: string;
  maxPoints: number;
  description?: string;
  criteria?: string;
}

interface QAScores {
  scores: Record<string, number>;
  total: number;
  maxTotal: number;
  percentage: number;
  rubricId: string;
  scoredAt: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingId, isRegenerate = false } = await req.json();
    
    if (!bookingId) {
      throw new Error('bookingId is required');
    }

    console.log(`Generating QA coaching audio for booking: ${bookingId}, isRegenerate: ${isRegenerate}`);

    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!ELEVENLABS_API_KEY || !LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch booking with agent data
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id,
        member_name,
        agent_id,
        booking_date,
        agents(id, name, site_id)
      `)
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingError) {
      throw new Error(`Failed to fetch booking: ${bookingError.message}`);
    }

    if (!booking) {
      throw new Error(`Booking not found: ${bookingId}`);
    }

    const agentId = booking.agent_id;
    const siteId = (booking.agents as any)?.site_id || null;

    // Fetch transcription with QA scores
    const { data: transcription, error: transcriptionError } = await supabase
      .from('booking_transcriptions')
      .select('*')
      .eq('booking_id', bookingId)
      .single();

    if (transcriptionError || !transcription) {
      throw new Error(`Failed to fetch transcription: ${transcriptionError?.message}`);
    }

    if (!transcription.qa_scores) {
      throw new Error('No QA scores found for this booking');
    }

    const qaScores = transcription.qa_scores as QAScores;

    // Fetch active QA rubric
    const { data: qaSettings } = await supabase
      .from('qa_settings')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (!qaSettings) {
      console.log('No active QA rubric found, using default categories');
    }

    const categories: QACategory[] = qaSettings?.categories || [
      { name: 'Greeting & Introduction', maxPoints: 10 },
      { name: 'Needs Discovery', maxPoints: 15 },
      { name: 'Clarity & Product Knowledge', maxPoints: 20 },
      { name: 'Handling Objections', maxPoints: 15 },
      { name: 'Booking Support/CTA', maxPoints: 20 },
      { name: 'Soft Skills & Tone', maxPoints: 10 }
    ];

    // Fetch QA coaching settings
    const { data: coachingSettings } = await supabase
      .from('qa_coaching_settings')
      .select('*')
      .eq('is_active', true)
      .single();

    const voiceId = coachingSettings?.voice_id || 'EXAVITQu4vr4xnSDxMaL'; // Sarah
    const coachingTone = coachingSettings?.coaching_tone || 'empathetic';
    const maxLengthSeconds = coachingSettings?.max_audio_length_seconds || 60;
    const alwaysEmphasize = coachingSettings?.always_emphasize || [];
    const neverMention = coachingSettings?.never_mention || [];

    // Calculate category scores with percentages
    const categoryResults: { name: string; score: number; maxPoints: number; percentage: number; criteria?: string }[] = [];
    
    for (const category of categories) {
      const score = qaScores.scores[category.name] || 0;
      const percentage = Math.round((score / category.maxPoints) * 100);
      categoryResults.push({
        name: category.name,
        score,
        maxPoints: category.maxPoints,
        percentage,
        criteria: category.criteria || category.description
      });
    }

    // Sort by percentage to find weakest areas (lowest scores)
    const sortedCategories = [...categoryResults].sort((a, b) => a.percentage - b.percentage);
    const weakestAreas = sortedCategories.slice(0, 3).filter(c => c.percentage < 80);

    const agentName = (booking.agents as any)?.name || 'Agent';
    const memberName = booking.member_name;

    // Calculate max words based on seconds (approx 2.5 words per second for natural speech)
    const maxWords = Math.round(maxLengthSeconds * 2.5);

    // Extract key points from transcription
    const callKeyPoints = transcription.call_key_points as any || {};
    const memberConcerns = callKeyPoints.memberConcerns || [];
    const objections = callKeyPoints.objections || [];
    const memberPreferences = callKeyPoints.memberPreferences || [];
    const callTranscript = transcription.call_transcription || '';

    // Build Katty's call-specific coaching prompt
    const kattyPrompt = `You are Katty, a warm, empathetic, and expert QA coach for PadSplit sales agents. Your feedback must be SPECIFIC to THIS CALL - generic advice is not helpful. You've read the full transcript and will reference exact moments.

AGENT NAME: ${agentName}
MEMBER/CUSTOMER: ${memberName}

OVERALL QA SCORE: ${qaScores.percentage}% (${qaScores.total}/${qaScores.maxTotal} points)

CATEGORY SCORES WITH EXPECTATIONS:
${categoryResults.map(c => `- ${c.name}: ${c.score}/${c.maxPoints} (${c.percentage}%)
  WHAT THIS CATEGORY CHECKS FOR:
  ${c.name === 'Greeting & Introduction' ? '• Did agent state their name clearly?\n  • Did agent mention PadSplit/company name?\n  • Was the opening warm and professional?' : ''}
  ${c.name === 'Needs Discovery' ? '• Did agent ask about move-in timeline?\n  • Did agent ask about budget/weekly rate?\n  • Did agent ask about location preferences?\n  • Did agent ask about roommate preferences (private vs shared)?\n  • Did agent probe to understand member situation?' : ''}
  ${c.name === 'Clarity & Product Knowledge' ? '• Did agent explain PadSplit policies clearly?\n  • Did agent explain the 12-week commitment and flexibility options?\n  • Did agent accurately describe available rooms/features?' : ''}
  ${c.name === 'Handling Objections' ? '• How did agent respond to member pushback or concerns?\n  • Did agent acknowledge concerns before responding?\n  • Did agent provide solutions or alternatives?' : ''}
  ${c.name === 'Booking Support/CTA' ? '• Did agent guide member toward booking?\n  • Did agent explain next steps clearly?\n  • Did agent create urgency appropriately?' : ''}
  ${c.name === 'Soft Skills & Tone' ? '• Was agent empathetic and patient?\n  • Did agent listen actively?\n  • Was the overall tone friendly and helpful?' : ''}`).join('\n\n')}

WEAKEST AREAS (FOCUS YOUR COACHING HERE):
${weakestAreas.length > 0 ? weakestAreas.map(c => `- ${c.name}: Only ${c.percentage}% (${c.score}/${c.maxPoints})`).join('\n') : 'All areas scored well!'}

CALL CONTEXT:
${transcription.call_summary ? `Summary: ${transcription.call_summary}` : ''}
${memberConcerns.length > 0 ? `Member Concerns: ${memberConcerns.join(', ')}` : ''}
${objections.length > 0 ? `Objections Raised: ${objections.join(', ')}` : ''}
${memberPreferences.length > 0 ? `Member Preferences: ${memberPreferences.join(', ')}` : ''}

FULL CALL TRANSCRIPT (READ THIS CAREFULLY - YOUR COACHING MUST REFERENCE SPECIFIC MOMENTS):
${callTranscript ? callTranscript.substring(0, 8000) : 'Transcript not available - base coaching on summary and scores.'}

${alwaysEmphasize.length > 0 ? `ALWAYS MENTION: ${alwaysEmphasize.join(', ')}` : ''}
${neverMention.length > 0 ? `NEVER MENTION: ${neverMention.join(', ')}` : ''}

YOUR COACHING MUST BE CALL-SPECIFIC:
1. Start warmly - "Hey ${agentName}, it's Katty. I listened to your call with ${memberName}..."

2. FOR EACH WEAK CATEGORY, YOU MUST:
   a) Quote or reference what the agent ACTUALLY SAID (or didn't say) from the transcript
   b) Explain specifically what was missed and why it matters
   c) Give a WORD-FOR-WORD example of what they could have said instead

   EXAMPLE FORMAT:
   "In your Greeting & Introduction, you jumped right in with 'Hello?' without introducing yourself. 
   Next time, try opening with: 'Hi ${memberName}, this is ${agentName} calling from PadSplit - thanks for reaching out! How can I help you find a room today?'"

   "I noticed during Needs Discovery, you didn't ask about their budget. When ${memberName} mentioned needing 
   a place by Sunday, that was the perfect moment to ask: 'What weekly rate works for your budget?' - 
   this helps you match them with the right rooms faster."

   "When ${memberName} said [quote their objection from transcript], you [describe what agent did]. 
   A stronger response would be: '[provide specific alternative response]'"

3. BE CONCRETE AND SPECIFIC:
   - DON'T SAY: "Try to ask more discovery questions"
   - DO SAY: "When they mentioned needing parking, follow up with: 'Do you have a car you'll need to park at the property?'"

4. End with genuine encouragement and one key takeaway

CRITICAL:
- Reference actual moments from the transcript - not generic advice
- Provide specific word-for-word examples the agent can use next time
- Tone: ${coachingTone}, warm, supportive - you're their coach, not their critic
- Maximum: ${maxWords} words (about ${maxLengthSeconds} seconds spoken)

Generate ONLY the spoken coaching script. No formatting, no quotes around the script, no stage directions.`;

    console.log('Generating QA coaching script with Lovable AI...');

    // Generate script using Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are Katty, an empathetic QA coach. Generate only the spoken coaching script, nothing else.' },
          { role: 'user', content: kattyPrompt }
        ],
        max_tokens: 500,
        temperature: 0.7
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const coachingScript = aiData.choices?.[0]?.message?.content?.trim();

    if (!coachingScript) {
      throw new Error('No coaching script generated');
    }

    console.log('Generated QA coaching script:', coachingScript.substring(0, 100) + '...');

    // Log Lovable AI cost for script generation
    const estimatedInputTokens = Math.ceil(kattyPrompt.length / 4);
    const estimatedOutputTokens = Math.ceil(coachingScript.length / 4);
    logApiCost(supabase, {
      service_provider: 'lovable_ai',
      service_type: 'qa_script_generation',
      edge_function: 'generate-qa-coaching-audio',
      booking_id: bookingId,
      agent_id: agentId,
      site_id: siteId,
      input_tokens: estimatedInputTokens,
      output_tokens: estimatedOutputTokens,
      metadata: { model: 'google/gemini-2.5-flash', script_length: coachingScript.length }
    });

    // Generate audio with ElevenLabs using Sarah's voice
    console.log(`Generating audio with ElevenLabs voice: ${voiceId}`);
    
    const elevenLabsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: coachingScript,
        model_id: 'eleven_turbo_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
          style: 0.4, // Slightly expressive for empathy
          use_speaker_boost: true
        }
      }),
    });

    if (!elevenLabsResponse.ok) {
      const errorText = await elevenLabsResponse.text();
      console.error('ElevenLabs error:', elevenLabsResponse.status, errorText);
      throw new Error(`ElevenLabs API error: ${elevenLabsResponse.status}`);
    }

    // Log ElevenLabs TTS cost
    logApiCost(supabase, {
      service_provider: 'elevenlabs',
      service_type: 'tts_qa_coaching',
      edge_function: 'generate-qa-coaching-audio',
      booking_id: bookingId,
      agent_id: agentId,
      site_id: siteId,
      character_count: coachingScript.length,
      metadata: { model: 'eleven_turbo_v2', voice_id: voiceId }
    });

    const audioBuffer = await elevenLabsResponse.arrayBuffer();
    const audioData = new Uint8Array(audioBuffer);

    console.log('Audio generated, uploading to storage...');

    // Upload to Supabase Storage
    const fileName = `qa-coaching-${bookingId}-${Date.now()}.mp3`;
    
    const { error: uploadError } = await supabase.storage
      .from('coaching-audio')
      .upload(fileName, audioData, {
        contentType: 'audio/mpeg',
        upsert: true
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw new Error(`Failed to upload audio: ${uploadError.message}`);
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('coaching-audio')
      .getPublicUrl(fileName);

    const audioUrl = publicUrlData.publicUrl;

    console.log('Audio uploaded, URL:', audioUrl);

    // Update booking_transcriptions with QA coaching audio
    const updateData: Record<string, any> = {
      qa_coaching_audio_url: audioUrl,
      qa_coaching_audio_generated_at: new Date().toISOString(),
    };

    if (isRegenerate) {
      // Keep the original generated_at, just update the URL
      updateData.qa_coaching_audio_generated_at = transcription.qa_coaching_audio_generated_at || new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('booking_transcriptions')
      .update(updateData)
      .eq('booking_id', bookingId);

    if (updateError) {
      console.error('Failed to update transcription:', updateError);
      throw new Error(`Failed to update transcription: ${updateError.message}`);
    }

    console.log('QA coaching audio generated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        audioUrl,
        script: coachingScript,
        weakestAreas: weakestAreas.map(c => c.name)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating QA coaching audio:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
