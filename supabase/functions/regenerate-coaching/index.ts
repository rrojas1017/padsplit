import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Fetch the existing booking with transcription
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('id, call_transcription, transcription_status')
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

    // Generate agent feedback with Lovable AI using the existing transcription
    console.log('Generating AI agent feedback...');
    const feedbackPrompt = `You are an expert at analyzing sales call transcriptions for a housing/rental service called PadSplit.
    
Analyze this call transcription and provide detailed agent performance feedback in JSON format.

TRANSCRIPTION:
${booking.call_transcription}

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
