import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingId } = await req.json();

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

    // Fetch booking with agent feedback and call details
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id, member_name, agent_feedback, agent_id, call_summary, call_key_points")
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error("Booking not found");
    }

    if (!booking.agent_feedback) {
      throw new Error("No agent feedback available for this booking");
    }

    // Fetch agent name separately
    const { data: agent } = await supabase
      .from("agents")
      .select("name")
      .eq("id", booking.agent_id)
      .single();

    const agentFeedback = booking.agent_feedback as AgentFeedback;
    const agentName = agent?.name || "Agent";
    const memberName = booking.member_name || "the member";
    const callSummary = booking.call_summary || "";
    const callKeyPoints = booking.call_key_points as {
      memberConcerns?: string[];
      memberPreferences?: string[];
      recommendedActions?: string[];
      objections?: string[];
      moveInReadiness?: { score?: number; assessment?: string };
      sentiment?: string;
    } | null;

    console.log(`Generating personalized coaching audio for agent: ${agentName}, member: ${memberName}`);

    // Extract call-specific details
    const concerns = callKeyPoints?.memberConcerns?.slice(0, 2).join(", ") || "";
    const objections = callKeyPoints?.objections?.slice(0, 2).join(", ") || "";
    const preferences = callKeyPoints?.memberPreferences?.slice(0, 2).join(", ") || "";
    const sentiment = callKeyPoints?.sentiment || "positive";

    // Step 1: Generate personalized motivational script using Lovable AI
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
1. Start with excitement using the MEMBER'S NAME: "What a great call with ${memberName}!" or "${agentName}, you crushed it with ${memberName}!"
2. Reference 1-2 SPECIFIC things from this call (an objection they handled, a concern they addressed, how they matched the member's needs)
3. If they handled an objection or concern well, mention it specifically: "When ${memberName} brought up [concern], you handled it perfectly by..."
4. Give ONE quick tip related to something from THIS call
5. End with high energy motivation for the next call

Tone: Energetic sports coach celebrating a win. Natural spoken language, contractions, enthusiasm!
Length: 150-200 words (about 1 minute)
DO NOT use generic phrases. Make it feel like you watched this specific call.

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
      throw new Error("Failed to generate audio from ElevenLabs");
    }

    // Convert audio to base64 using chunked encoding to avoid stack overflow
    const audioArrayBuffer = await ttsResponse.arrayBuffer();
    const bytes = new Uint8Array(audioArrayBuffer);
    let binary = '';
    const chunkSize = 8192; // Process in 8KB chunks to avoid stack overflow
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const audioBase64 = btoa(binary);

    // Create data URL for audio
    const audioDataUrl = `data:audio/mpeg;base64,${audioBase64}`;

    // Step 3: Update booking with audio URL
    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        coaching_audio_url: audioDataUrl,
        coaching_audio_generated_at: new Date().toISOString(),
      })
      .eq("id", bookingId);

    if (updateError) {
      console.error("Failed to update booking:", updateError);
      throw new Error("Failed to save coaching audio");
    }

    console.log("Coaching audio generated and saved successfully");

    return new Response(
      JSON.stringify({
        success: true,
        audioUrl: audioDataUrl,
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