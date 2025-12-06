import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Default coaching prompt
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

async function processBooking(supabase: any, lovableApiKey: string, bookingId: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`Processing booking ${bookingId}...`);

    // Fetch the booking
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('id, call_transcription, transcription_status, member_name')
      .eq('id', bookingId)
      .single();

    if (fetchError || !booking) {
      return { success: false, error: `Booking not found: ${fetchError?.message}` };
    }

    if (!booking.call_transcription) {
      return { success: false, error: 'No transcription found' };
    }

    // Generate AI feedback
    const feedbackPrompt = buildDefaultCoachingPrompt(booking.call_transcription);

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: feedbackPrompt }],
      }),
    });

    if (!aiResponse.ok) {
      return { success: false, error: `AI error: ${aiResponse.status}` };
    }

    const aiResult = await aiResponse.json();
    const aiContent = aiResult.choices?.[0]?.message?.content || '';

    // Parse JSON
    let agentFeedback = null;
    try {
      let cleanedContent = aiContent.trim();
      if (cleanedContent.startsWith('```json')) cleanedContent = cleanedContent.slice(7);
      if (cleanedContent.startsWith('```')) cleanedContent = cleanedContent.slice(3);
      if (cleanedContent.endsWith('```')) cleanedContent = cleanedContent.slice(0, -3);
      cleanedContent = cleanedContent.trim();
      
      const parsed = JSON.parse(cleanedContent);
      agentFeedback = parsed.agentFeedback || null;
    } catch (parseError) {
      return { success: false, error: 'Failed to parse AI response' };
    }

    if (!agentFeedback) {
      return { success: false, error: 'No valid feedback returned' };
    }

    // Update booking
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ agent_feedback: agentFeedback })
      .eq('id', bookingId);

    if (updateError) {
      return { success: false, error: `Update failed: ${updateError.message}` };
    }

    console.log(`✓ Coaching generated for ${booking.member_name}`);
    return { success: true };

  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!lovableApiKey) throw new Error('LOVABLE_API_KEY not configured');

    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

    // The 5 bookings missing feedback
    const bookingIds = [
      '3f6fc83c-64cb-4b0c-bd03-731da9b7f4e7', // Dickie Dreher
      '35adcd45-5573-4b0a-8547-265d8b64a21c', // Victoria Collins
      'ac061ce8-7d0e-424d-850e-e30b9d11a7bb', // Dashaun Frazier
      '927cf4e6-e2c8-4472-800e-fde58a6f1ac4', // Jawon Poirtier
      '27b074b4-dafe-4a8d-b345-590079b52d9e', // Alan Long
    ];

    console.log(`Processing ${bookingIds.length} bookings...`);

    const results = [];
    for (const id of bookingIds) {
      const result = await processBooking(supabase, lovableApiKey, id);
      results.push({ bookingId: id, ...result });
      
      // Small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`Completed: ${succeeded} succeeded, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${bookingIds.length} bookings: ${succeeded} succeeded, ${failed} failed`,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Batch error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
