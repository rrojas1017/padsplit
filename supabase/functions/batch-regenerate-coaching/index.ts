import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  } catch (error) {
    console.error('[Cost] Failed to log cost:', error);
  }
}

async function generateAudioForBooking(
  supabase: any,
  elevenlabsApiKey: string,
  lovableApiKey: string,
  bookingId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Fetch booking basic info
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id, member_name, agent_id, agents(site_id)")
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      return { success: false, error: "Booking not found" };
    }

    const agentId = booking.agent_id || null;
    const siteId = (booking.agents as any)?.site_id || null;

    // Fetch transcription data
    const { data: transcriptionData, error: transcriptionError } = await supabase
      .from("booking_transcriptions")
      .select("agent_feedback, call_summary, call_key_points")
      .eq("booking_id", bookingId)
      .single();

    if (transcriptionError || !transcriptionData?.agent_feedback) {
      return { success: false, error: "No agent feedback available" };
    }

    // Fetch agent name
    const { data: agent } = await supabase
      .from("agents")
      .select("name")
      .eq("id", booking.agent_id)
      .single();

    const agentFeedback = transcriptionData.agent_feedback as AgentFeedback;
    const agentName = agent?.name || "Agent";
    const memberName = booking.member_name || "the member";
    const callSummary = transcriptionData.call_summary || "";
    const callKeyPoints = transcriptionData.call_key_points as {
      memberConcerns?: string[];
      memberPreferences?: string[];
      objections?: string[];
      sentiment?: string;
    } | null;

    const concerns = callKeyPoints?.memberConcerns?.slice(0, 2).join(", ") || "";
    const objections = callKeyPoints?.objections?.slice(0, 2).join(", ") || "";
    const preferences = callKeyPoints?.memberPreferences?.slice(0, 2).join(", ") || "";
    const sentiment = callKeyPoints?.sentiment || "positive";

    // Generate script using Lovable AI
    const scriptPrompt = `You are an enthusiastic motivational coach delivering personalized feedback to a sales agent who just completed a booking.

Create a ~60 second spoken script that is SPECIFIC to THIS call. Reference the member by name and mention actual moments from the conversation.

CALL DETAILS:
- Agent Name: ${agentName}
- Member Name: ${memberName}
- Call Summary: ${callSummary || "Successful booking call"}
- Member's Concerns: ${concerns || "None mentioned"}
- Objections Handled: ${objections || "None"}
- What Member Wanted: ${preferences || "Standard preferences"}
- Call Sentiment: ${sentiment}

PERFORMANCE SCORES:
- Overall Rating: ${agentFeedback.overallRating}
- Communication: ${agentFeedback.scores?.communication || 7}/10
- Product Knowledge: ${agentFeedback.scores?.productKnowledge || 7}/10
- Objection Handling: ${agentFeedback.scores?.objectionHandling || 7}/10
- Closing Skills: ${agentFeedback.scores?.closingSkills || 7}/10

WHAT THEY DID WELL: ${agentFeedback.strengths?.join(", ") || "Strong performance"}
AREAS TO IMPROVE: ${agentFeedback.improvements?.join(", ") || "Continue developing"}

YOUR SCRIPT MUST:
1. Start with GENUINE EXCITEMENT - vary your opening each time!
2. Reference 1-2 SPECIFIC things from THIS call
3. Give ONE quick tip for improvement
4. End with high-energy motivation

Tone: Energetic but VARIED - like a real coach who celebrates differently each time.
Length: 150-200 words (about 1 minute)

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
      return { success: false, error: "Failed to generate script" };
    }

    const aiData = await aiResponse.json();
    const coachingScript = aiData.choices?.[0]?.message?.content;

    if (!coachingScript) {
      return { success: false, error: "No script generated" };
    }

    // Log AI cost for script generation
    const inputTokens = Math.ceil(scriptPrompt.length / 4);
    const outputTokens = Math.ceil(coachingScript.length / 4);
    logApiCost(supabase, {
      service_provider: 'lovable_ai',
      service_type: 'ai_coaching',
      edge_function: 'batch-regenerate-coaching',
      booking_id: bookingId,
      agent_id: agentId,
      site_id: siteId,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      metadata: { model: 'google/gemini-2.5-flash', batch: true }
    });

    // Convert to audio using ElevenLabs
    const voiceId = "nPczCjzI2devNBz1zQrb"; // Brian voice
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
      return { success: false, error: "Failed to generate audio" };
    }

    // Log TTS cost
    logApiCost(supabase, {
      service_provider: 'elevenlabs',
      service_type: 'tts_coaching',
      edge_function: 'batch-regenerate-coaching',
      booking_id: bookingId,
      agent_id: agentId,
      site_id: siteId,
      character_count: coachingScript.length,
      metadata: { voice_id: voiceId, model: 'eleven_turbo_v2', batch: true }
    });

    // Upload to storage
    const audioArrayBuffer = await ttsResponse.arrayBuffer();
    const audioBytes = new Uint8Array(audioArrayBuffer);
    const fileName = `coaching-${bookingId}-${Date.now()}.mp3`;

    const { error: uploadError } = await supabase.storage
      .from("coaching-audio")
      .upload(fileName, audioBytes, {
        contentType: "audio/mpeg",
        upsert: true,
      });

    if (uploadError) {
      return { success: false, error: "Failed to upload audio" };
    }

    const { data: publicUrlData } = supabase.storage
      .from("coaching-audio")
      .getPublicUrl(fileName);

    // Update booking_transcriptions
    const { error: updateError } = await supabase
      .from("booking_transcriptions")
      .update({
        coaching_audio_url: publicUrlData.publicUrl,
        coaching_audio_generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("booking_id", bookingId);

    if (updateError) {
      return { success: false, error: "Failed to update database" };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const elevenlabsApiKey = Deno.env.get("ELEVENLABS_API_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!elevenlabsApiKey || !lovableApiKey) {
      throw new Error("Required API keys not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find all bookings with agent_feedback but no coaching audio
    const { data: bookingsToProcess, error: queryError } = await supabase
      .from("booking_transcriptions")
      .select("booking_id")
      .not("agent_feedback", "is", null)
      .or("coaching_audio_url.is.null,coaching_audio_url.eq.")
      .limit(100);

    if (queryError) {
      throw new Error(`Query failed: ${queryError.message}`);
    }

    console.log(`Found ${bookingsToProcess?.length || 0} bookings to process`);

    const results = {
      total: bookingsToProcess?.length || 0,
      succeeded: 0,
      failed: 0,
      errors: [] as { bookingId: string; error: string }[],
    };

    // Process each booking with delay to avoid rate limiting
    for (const item of bookingsToProcess || []) {
      console.log(`Processing booking: ${item.booking_id}`);
      
      const result = await generateAudioForBooking(
        supabase,
        elevenlabsApiKey,
        lovableApiKey,
        item.booking_id
      );

      if (result.success) {
        results.succeeded++;
        console.log(`✓ Success: ${item.booking_id}`);
      } else {
        results.failed++;
        results.errors.push({ bookingId: item.booking_id, error: result.error || "Unknown" });
        console.log(`✗ Failed: ${item.booking_id} - ${result.error}`);
      }

      // Wait 10 seconds between each to avoid rate limiting (per memory)
      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    console.log(`Batch complete: ${results.succeeded} succeeded, ${results.failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Batch processing error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
