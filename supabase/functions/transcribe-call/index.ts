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

// Background transcription processing
async function processTranscription(bookingId: string, kixieUrl: string) {
  console.log(`[Background] Starting transcription for booking ${bookingId}`);
  
  const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

  try {
    // Update status to processing
    await supabase
      .from('bookings')
      .update({ transcription_status: 'processing' })
      .eq('id', bookingId);

    // Step 1: Download the audio file
    console.log('[Background] Downloading audio file...');
    const audioResponse = await fetch(kixieUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.status}`);
    }
    const audioBlob = await audioResponse.blob();
    const fileSizeMB = audioBlob.size / (1024 * 1024);
    console.log(`[Background] Audio downloaded, size: ${audioBlob.size} bytes (${fileSizeMB.toFixed(2)} MB)`);

    // Step 2: Transcribe with ElevenLabs Speech-to-Text
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
    let transcription = elevenLabsResult.text || '';
    let callDurationSeconds: number | null = null;
    
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
    
    console.log('[Background] Transcription complete, length:', transcription.length);

    // Step 3: Generate summary, key points, and agent feedback with Lovable AI
    console.log('[Background] Generating AI summary and agent feedback...');
    const summaryPrompt = `You are an expert at analyzing sales call transcriptions for PadSplit, a housing/rental service.

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
        callSentiment: parsed.callSentiment || 'neutral'
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

    // Step 4: Update the booking with transcription data and agent feedback
    console.log('[Background] Updating booking with transcription data and agent feedback...');
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        call_transcription: transcription,
        call_summary: summary,
        call_key_points: keyPoints,
        call_duration_seconds: callDurationSeconds,
        transcription_status: 'completed',
        transcribed_at: new Date().toISOString(),
        agent_feedback: agentFeedback,
      })
      .eq('id', bookingId);

    if (updateError) {
      console.error('[Background] Update error:', updateError);
      throw new Error(`Failed to update booking: ${updateError.message}`);
    }

    console.log(`[Background] Transcription completed successfully for booking ${bookingId}`);

  } catch (error) {
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
