import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Improved prompt with examples and explicit instructions
const buildAnalysisPrompt = (transcription: string) => `You are an expert at analyzing sales call transcriptions for PadSplit, a housing/rental service.

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

// Retry logic for AI calls
async function callAIWithRetry(
  lovableApiKey: string, 
  transcription: string, 
  maxRetries = 2
): Promise<{ keyPoints: any; agentFeedback: any; summary: string }> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[ReAnalyze] AI attempt ${attempt + 1}/${maxRetries + 1}`);
      
      const prompt = buildAnalysisPrompt(transcription);
      
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'user', content: prompt }
          ],
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        throw new Error(`AI API error: ${aiResponse.status} - ${errorText}`);
      }

      const aiResult = await aiResponse.json();
      const aiContent = aiResult.choices?.[0]?.message?.content || '';
      
      // Clean and parse JSON
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
      
      // Validate the response has meaningful content
      const summary = parsed.summary || '';
      if (summary.length < 20 || summary.includes('parsing failed')) {
        throw new Error('AI returned insufficient summary');
      }
      
      const agentFeedback = parsed.agentFeedback || null;
      
      // Validate agent feedback has scores
      if (agentFeedback && (!agentFeedback.scores || typeof agentFeedback.scores.communication !== 'number')) {
        console.log('[ReAnalyze] Warning: Agent feedback missing scores, retrying...');
        if (attempt < maxRetries) {
          throw new Error('Agent feedback missing required scores');
        }
      }
      
      const keyPoints = {
        summary: parsed.summary,
        memberConcerns: parsed.memberConcerns || [],
        memberPreferences: parsed.memberPreferences || [],
        recommendedActions: parsed.recommendedActions || [],
        objections: parsed.objections || [],
        moveInReadiness: parsed.moveInReadiness || 'medium',
        callSentiment: parsed.callSentiment || 'neutral'
      };
      
      console.log('[ReAnalyze] AI parsing successful:', {
        summaryLength: summary.length,
        concerns: keyPoints.memberConcerns.length,
        preferences: keyPoints.memberPreferences.length,
        hasAgentFeedback: !!agentFeedback
      });
      
      return { keyPoints, agentFeedback, summary };
      
    } catch (error) {
      console.error(`[ReAnalyze] Attempt ${attempt + 1} failed:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries) {
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }
  
  throw lastError || new Error('AI analysis failed after retries');
}

serve(async (req) => {
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

    console.log(`[ReAnalyze] Starting re-analysis for booking ${bookingId}`);

    // Fetch the existing booking with transcription
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('id, call_transcription, transcription_status, call_duration_seconds')
      .eq('id', bookingId)
      .single();

    if (fetchError || !booking) {
      throw new Error(`Booking not found: ${fetchError?.message || 'Unknown error'}`);
    }

    if (!booking.call_transcription) {
      throw new Error('No transcription found. Please transcribe the call first.');
    }

    if (booking.transcription_status !== 'completed') {
      throw new Error('Transcription is not completed yet.');
    }

    console.log(`[ReAnalyze] Found transcription (${booking.call_transcription.length} chars, ${booking.call_duration_seconds}s duration)`);

    // Re-analyze with improved prompt and retry logic
    const { keyPoints, agentFeedback, summary } = await callAIWithRetry(
      lovableApiKey,
      booking.call_transcription
    );

    // Update the booking with new analysis
    console.log('[ReAnalyze] Updating booking with new analysis...');
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        call_summary: summary,
        call_key_points: keyPoints,
        agent_feedback: agentFeedback,
      })
      .eq('id', bookingId);

    if (updateError) {
      console.error('[ReAnalyze] Update error:', updateError);
      throw new Error(`Failed to update booking: ${updateError.message}`);
    }

    console.log(`[ReAnalyze] Successfully re-analyzed booking ${bookingId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Call re-analyzed successfully',
        bookingId,
        keyPoints,
        agentFeedback,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ReAnalyze] Error:', error);
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
