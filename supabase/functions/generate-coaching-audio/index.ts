import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
  triggered_by_user_id?: string;
  is_internal?: boolean;
}) {
  try {
    let cost = 0;
    
    if (params.service_provider === 'elevenlabs') {
      if (params.audio_duration_seconds) {
        cost = (params.audio_duration_seconds / 60) * 0.034;
      }
      if (params.character_count) {
        cost = params.character_count * 0.00015;
      }
    } else if (params.service_provider === 'lovable_ai') {
      const model = params.metadata?.model || 'google/gemini-2.5-flash';
      let inputRate = 0.0001;
      let outputRate = 0.0003;
      
      if (model.includes('gemini-2.5-pro')) {
        inputRate = 0.00125;
        outputRate = 0.005;
      }
      
      const inputCost = ((params.input_tokens || 0) / 1000) * inputRate;
      const outputCost = ((params.output_tokens || 0) / 1000) * outputRate;
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
      metadata: params.metadata || {},
      triggered_by_user_id: params.triggered_by_user_id || null,
      is_internal: params.is_internal || false,
    });
    
    console.log(`[Cost] Logged ${params.service_provider} ${params.service_type}: $${cost.toFixed(6)}`);
  } catch (error) {
    // Don't fail the main operation if cost logging fails
    console.error('[Cost] Failed to log API cost:', error);
  }
}

interface AgentFeedback {
  overallRating: string;
  strengths: string[];
  improvements: string[];
  coachingTips: string[];
  scores: {
    communication: number;
    productKnowledge: number;
    objectionHandling: number;
    closingSkills: number;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { bookingId } = body;
    
    console.log("Received request:", { bookingId, body });

    // Detect if triggered by super_admin
    let triggeredByUserId: string | null = null;
    let isInternal = false;
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      try {
        const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await anonClient.auth.getUser(token);
        if (user) {
          triggeredByUserId = user.id;
          const adminClient = createClient(supabaseUrl, supabaseServiceKey);
          const { data: roleData } = await adminClient.from('user_roles').select('role').eq('user_id', user.id).single();
          isInternal = roleData?.role === 'super_admin';
          if (isInternal) console.log('[Internal] Request triggered by super_admin, marking costs as internal');
        }
      } catch (e) { console.log('[Internal] Could not determine user role:', e); }
    }

    if (!bookingId) {
      throw new Error("Booking ID is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const elevenlabsApiKey = Deno.env.get("ELEVENLABS_API_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!elevenlabsApiKey) {
      throw new Error("ELEVENLABS_API_KEY is not configured");
    }

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch booking basic info with agent's site
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id, member_name, agent_id, agents(id, name, site_id)")
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error("Booking not found");
    }

    const agentId = booking.agent_id;
    const siteId = (booking.agents as any)?.site_id || null;

    // Fetch transcription data INCLUDING full transcript from booking_transcriptions table
    const { data: transcriptionData, error: transcriptionError } = await supabase
      .from("booking_transcriptions")
      .select("agent_feedback, call_summary, call_key_points, call_transcription")
      .eq("booking_id", bookingId)
      .single();

    if (transcriptionError || !transcriptionData?.agent_feedback) {
      throw new Error("No agent feedback available for this booking");
    }

    const agentFeedback = transcriptionData.agent_feedback as AgentFeedback;
    const agentName = (booking.agents as any)?.name || "Agent";
    const memberName = booking.member_name || "the member";
    const callSummary = transcriptionData.call_summary || "";
    const callTranscript = transcriptionData.call_transcription || "";
    const callKeyPoints = transcriptionData.call_key_points as {
      memberConcerns?: string[];
      memberPreferences?: string[];
      recommendedActions?: string[];
      objections?: string[];
      moveInReadiness?: { score?: number; assessment?: string };
      sentiment?: string;
    } | null;

    console.log(`Generating call-specific coaching audio for agent: ${agentName}, member: ${memberName}, transcript length: ${callTranscript.length}`);

    // Extract call-specific details for context
    const concerns = callKeyPoints?.memberConcerns?.slice(0, 3).join("; ") || "";
    const objections = callKeyPoints?.objections?.slice(0, 3).join("; ") || "";
    const preferences = callKeyPoints?.memberPreferences?.slice(0, 3).join("; ") || "";
    const sentiment = callKeyPoints?.sentiment || "positive";

    // Identify weakest areas for focused coaching
    const scores = agentFeedback.scores || { communication: 7, productKnowledge: 7, objectionHandling: 7, closingSkills: 7 };
    const scoreEntries = [
      { name: 'Communication', score: scores.communication },
      { name: 'Product Knowledge', score: scores.productKnowledge },
      { name: 'Objection Handling', score: scores.objectionHandling },
      { name: 'Closing Skills', score: scores.closingSkills }
    ].sort((a, b) => a.score - b.score);
    const weakestArea = scoreEntries[0];
    const secondWeakest = scoreEntries[1];

    // Step 1: Generate personalized motivational script using Lovable AI with FULL TRANSCRIPT
    const scriptPrompt = `You are Jeff, an enthusiastic but HIGHLY SPECIFIC performance coach delivering personalized feedback to a sales agent.

CRITICAL: You MUST reference EXACT moments from the transcript. Quote what the agent actually said. Give word-for-word alternatives.

=== AGENT & CALL INFO ===
Agent: ${agentName}
Member: ${memberName}
Overall Rating: ${agentFeedback.overallRating}

=== PERFORMANCE SCORES ===
- Communication: ${scores.communication}/10
- Product Knowledge: ${scores.productKnowledge}/10
- Objection Handling: ${scores.objectionHandling}/10
- Closing Skills: ${scores.closingSkills}/10

WEAKEST AREA: ${weakestArea.name} (${weakestArea.score}/10)
SECOND WEAKEST: ${secondWeakest.name} (${secondWeakest.score}/10)

=== CALL CONTEXT ===
Summary: ${callSummary || "Booking call completed"}
Member Concerns: ${concerns || "None noted"}
Objections Raised: ${objections || "None"}
Member Preferences: ${preferences || "Standard"}
Call Sentiment: ${sentiment}

=== FULL CALL TRANSCRIPT (reference specific moments!) ===
${callTranscript.substring(0, 8000)}

=== YOUR COACHING SCRIPT REQUIREMENTS ===

1. OPENING (vary your style - pick ONE):
   - Celebratory: "What an incredible call with ${memberName}!"
   - Impressed: "${agentName}, that was solid work!"
   - Hype: "You brought the energy with ${memberName}!"
   - Casual: "Hey ${agentName}! Let's break down that call!"

2. SPECIFIC PRAISE - Quote the transcript!
   Find something the agent said well and QUOTE IT:
   "When ${memberName} asked about [topic], you said '[exact quote from transcript]' - that was perfect because..."

3. SPECIFIC IMPROVEMENT - Quote what they said AND give alternative!
   Focus on their WEAKEST AREA (${weakestArea.name}):
   "When ${memberName} mentioned [concern], you said '[what agent actually said]'. Next time, try: '[word-for-word better response]'"
   
   EXAMPLE FORMAT:
   "When the member asked about pricing, you said 'I'm not sure about that' - next time try: 'Great question! Our weekly rates start at around $150 and include all utilities. What's your budget looking like?'"

4. ONE ACTIONABLE TIP for ${weakestArea.name}:
   Give a specific technique they can use on their next call.

5. ENERGETIC CLOSE (vary it):
   - "Keep that momentum going!"
   - "Can't wait to hear your next call!"
   - "You've got this - now go close another one!"

=== CRITICAL RULES ===
- You MUST quote actual phrases from the transcript
- You MUST provide word-for-word alternative responses
- Focus coaching on ${weakestArea.name} since that's their lowest score
- Sound like a REAL coach, not a script
- Use natural contractions and conversational tone
- Each script should feel FRESH and SPECIFIC to THIS call

Tone: Energetic, supportive, but SPECIFIC - like a real coach who watched the actual call
Length: 180-250 words (about 90 seconds)

Generate ONLY the spoken script, no stage directions or formatting.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: "You are an enthusiastic motivational coach creating spoken audio scripts for sales agents." },
          { role: "user", content: scriptPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", errorText);
      throw new Error("Failed to generate coaching script");
    }

    const aiData = await aiResponse.json();
    const coachingScript = aiData.choices?.[0]?.message?.content;

    if (!coachingScript) {
      throw new Error("No script generated from AI");
    }

    console.log("Generated script:", coachingScript.substring(0, 100) + "...");

    // Log Lovable AI cost for script generation
    const estimatedInputTokens = Math.ceil(scriptPrompt.length / 4);
    const estimatedOutputTokens = Math.ceil(coachingScript.length / 4);
    logApiCost(supabase, {
      service_provider: 'lovable_ai',
      service_type: 'tts_script_generation',
      edge_function: 'generate-coaching-audio',
      booking_id: bookingId,
      agent_id: agentId,
      site_id: siteId,
      input_tokens: estimatedInputTokens,
      output_tokens: estimatedOutputTokens,
      metadata: { model: 'google/gemini-2.5-pro', script_length: coachingScript.length },
      triggered_by_user_id: triggeredByUserId || undefined,
      is_internal: isInternal,
    });

    // Step 2: Convert script to audio using ElevenLabs
    // Using "Brian" voice - energetic male coach
    const voiceId = "nPczCjzI2devNBz1zQrb";

    const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": elevenlabsApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: coachingScript,
        model_id: "eleven_turbo_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.4,
          use_speaker_boost: true,
        },
      }),
    });

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error("ElevenLabs API error:", errorText);
      
      // Parse error for specific handling
      let errorDetails: any = {};
      try {
        errorDetails = JSON.parse(errorText);
      } catch { /* ignore parse errors */ }
      
      const status = errorDetails?.detail?.status;
      const message = errorDetails?.detail?.message || errorText;
      
      // Detect billing/payment issues
      if (status === 'payment_issue' || ttsResponse.status === 402) {
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
            message: `Coaching audio generation is failing due to a billing problem: ${message}`,
            severity: 'critical',
            metadata: { status, booking_id: bookingId, raw_error: errorText.substring(0, 500) }
          });
          console.log('[Billing Alert] Created critical notification for ElevenLabs payment issue');
        }
        
        throw new Error(`ElevenLabs billing issue: ${message}. Please check your ElevenLabs subscription.`);
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
            message: `Coaching audio quota has been exceeded: ${message}`,
            severity: 'warning',
            metadata: { status, booking_id: bookingId }
          });
          console.log('[Billing Alert] Created warning notification for ElevenLabs quota exceeded');
        }
        
        throw new Error(`ElevenLabs quota exceeded: ${message}`);
      }
      
      throw new Error(`ElevenLabs TTS error: ${ttsResponse.status} - ${message}`);
    }

    // Log ElevenLabs TTS cost
    logApiCost(supabase, {
      service_provider: 'elevenlabs',
      service_type: 'tts_coaching',
      edge_function: 'generate-coaching-audio',
      booking_id: bookingId,
      agent_id: agentId,
      site_id: siteId,
      character_count: coachingScript.length,
      metadata: { model: 'eleven_turbo_v2', voice_id: voiceId },
      triggered_by_user_id: triggeredByUserId || undefined,
      is_internal: isInternal,
    });

    // Get audio as array buffer
    const audioArrayBuffer = await ttsResponse.arrayBuffer();
    const audioBytes = new Uint8Array(audioArrayBuffer);
    
    // Upload to Supabase Storage instead of storing as base64
    const fileName = `coaching-${bookingId}-${Date.now()}.mp3`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("coaching-audio")
      .upload(fileName, audioBytes, {
        contentType: "audio/mpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      throw new Error("Failed to upload audio to storage");
    }

    // Get the public URL for the uploaded audio
    const { data: publicUrlData } = supabase.storage
      .from("coaching-audio")
      .getPublicUrl(fileName);

    const audioUrl = publicUrlData.publicUrl;
    console.log("Audio uploaded to storage:", audioUrl);

    // Step 3: Update booking_transcriptions with storage URL
    const { error: updateError } = await supabase
      .from("booking_transcriptions")
      .update({
        coaching_audio_url: audioUrl,
        coaching_audio_generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("booking_id", bookingId);

    if (updateError) {
      console.error("Failed to update booking_transcriptions:", updateError);
      throw new Error("Failed to save coaching audio");
    }

    return new Response(
      JSON.stringify({
        success: true,
        audioUrl: audioUrl,
        script: coachingScript,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in generate-coaching-audio:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        success: false 
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
