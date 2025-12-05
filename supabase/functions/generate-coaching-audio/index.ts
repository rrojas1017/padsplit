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

    // Fetch booking with agent feedback
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id, member_name, agent_feedback, agent_id")
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

    console.log(`Generating coaching audio for agent: ${agentName}`);

    // Step 1: Generate motivational script using Lovable AI
    const scriptPrompt = `You are an enthusiastic motivational coach delivering personalized feedback to a sales agent who just completed a booking.

Create a ~60 second spoken script that:
1. Opens with congratulations and energy (celebrate the win!)
2. Highlights 2-3 specific strengths from their call
3. Gives ONE actionable tip for improvement (framed positively)
4. Briefly mentions their scores in a motivating way
5. Ends with motivation to crush their next call

Tone: Upbeat, supportive, like a sports coach after a good play. Use natural spoken language.
Length: 150-200 words (about 1 minute when spoken)
Important: Write this as if you're speaking directly to them. Use "you" and their name.

Agent Name: ${agentName}
Overall Rating: ${agentFeedback.overallRating}
Strengths: ${agentFeedback.strengths?.join(", ") || "Strong performance"}
Areas for Growth: ${agentFeedback.improvements?.join(", ") || "Continue developing"}
Coaching Tips: ${agentFeedback.coachingTips?.join(", ") || "Keep up the great work"}
Scores:
- Communication: ${agentFeedback.scores?.communication || 7}/10
- Product Knowledge: ${agentFeedback.scores?.productKnowledge || 7}/10
- Objection Handling: ${agentFeedback.scores?.objectionHandling || 7}/10
- Closing Skills: ${agentFeedback.scores?.closingSkills || 7}/10

Generate ONLY the spoken script, no stage directions or notes.`;

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

    // Convert audio to base64
    const audioArrayBuffer = await ttsResponse.arrayBuffer();
    const audioBase64 = btoa(
      String.fromCharCode(...new Uint8Array(audioArrayBuffer))
    );

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