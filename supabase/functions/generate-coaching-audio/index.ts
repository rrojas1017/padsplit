import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { requireUserOrInternal, canSeeBooking, jsonResponse, corsHeaders, STAFF } from "../_shared/auth.ts";
import { logApiCost, tokensFromUsage } from "../_shared/costs.ts";


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

  const auth = await requireUserOrInternal(req, STAFF);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { bookingId, isRegenerate = false } = body;
    
    console.log("Received request:", { bookingId, body });

    if (!bookingId) {
      throw new Error("Booking ID is required");
    }

    if (!(await canSeeBooking(auth.ctx, bookingId))) {
      return jsonResponse(404, { error: 'Booking not found' });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Attribution from the verified caller
    const triggeredByUserId: string | null = auth.ctx.kind === 'user' ? auth.ctx.userId : null;
    const isInternal = auth.ctx.kind === 'user' && auth.ctx.role === 'super_admin';
    if (isInternal) console.log('[Internal] Request triggered by super_admin, marking costs as internal');
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
      .select("agent_feedback, call_summary, call_key_points, call_transcription, coaching_audio_url")
      .eq("booking_id", bookingId)
      .single();

    if (transcriptionError || !transcriptionData?.agent_feedback) {
      throw new Error("No agent feedback available for this booking");
    }

    // Skip generation if audio already exists and this isn't a regeneration request
    if (transcriptionData.coaching_audio_url && !isRegenerate) {
      console.log(`[Skip] Coaching audio already exists for booking ${bookingId}, returning existing URL`);
      return new Response(
        JSON.stringify({
          success: true,
          audioUrl: transcriptionData.coaching_audio_url,
          skipped: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isSuperAdminCaller = auth.ctx.kind === 'user' && auth.ctx.role === 'super_admin';
    if (!isSuperAdminCaller) {
      const { data: gateRows, error: gateErr } = await supabase.rpc('get_daily_coaching_gate');
      if (gateErr) {
        console.error('[CostGate] RPC failed, continuing (fail-open):', gateErr.message);
      } else {
        const gate: any = Array.isArray(gateRows) ? gateRows[0] : gateRows;
        if (gate?.is_blocked) {
          return new Response(
            JSON.stringify({ success: false, blocked: true, reason: 'daily_cost_gate',
              todayAvg: Number(gate.today_avg ?? 0), recordCount: Number(gate.record_count ?? 0) }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
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
      callSentiment?: string;
    } | null;

    console.log(`Generating call-specific coaching audio for agent: ${agentName}, member: ${memberName}, transcript length: ${callTranscript.length}`);

    // Extract call-specific details for context
    const concerns = callKeyPoints?.memberConcerns?.slice(0, 3).join("; ") || "";
    const objections = callKeyPoints?.objections?.slice(0, 3).join("; ") || "";
    const preferences = callKeyPoints?.memberPreferences?.slice(0, 3).join("; ") || "";
    const sentiment = callKeyPoints?.callSentiment ?? callKeyPoints?.sentiment ?? 'neutral';

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
        model: "google/gemini-2.5-flash",
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
    const tk = tokensFromUsage(aiData, scriptPrompt, coachingScript);
    const estimatedInputTokens = tk.inputTokens;
    const estimatedOutputTokens = tk.outputTokens;
    await logApiCost(supabase, {
      service_provider: 'lovable_ai',
      service_type: 'tts_script_generation',
      edge_function: 'generate-coaching-audio',
      booking_id: bookingId,
      agent_id: agentId,
      site_id: siteId,
      input_tokens: estimatedInputTokens,
      token_source: tk.source,
      output_tokens: estimatedOutputTokens,
      metadata: { model: 'google/gemini-2.5-flash', script_length: coachingScript.length },
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
    await logApiCost(supabase, {
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
