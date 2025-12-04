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
    const { bookingId, kixieUrl } = await req.json();
    
    if (!bookingId || !kixieUrl) {
      throw new Error('Missing bookingId or kixieUrl');
    }

    console.log(`Starting transcription for booking ${bookingId}`);
    console.log(`Kixie URL: ${kixieUrl}`);

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

    // Update status to processing
    await supabase
      .from('bookings')
      .update({ transcription_status: 'processing' })
      .eq('id', bookingId);

    // Step 1: Download the audio file
    console.log('Downloading audio file...');
    const audioResponse = await fetch(kixieUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.status}`);
    }
    const audioBlob = await audioResponse.blob();
    console.log(`Audio downloaded, size: ${audioBlob.size} bytes`);

    // Step 2: Transcribe with OpenAI Whisper
    console.log('Sending to OpenAI Whisper...');
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.wav');
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');

    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: formData,
    });

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error('Whisper API error:', errorText);
      throw new Error(`Whisper API error: ${whisperResponse.status}`);
    }

    const whisperResult = await whisperResponse.json();
    const transcription = whisperResult.text;
    console.log('Transcription complete, length:', transcription.length);

    // Step 3: Generate summary and key points with Lovable AI
    console.log('Generating AI summary...');
    const summaryPrompt = `You are an expert at analyzing sales call transcriptions for a housing/rental service called PadSplit. 
    
Analyze this call transcription and extract structured insights in JSON format.

TRANSCRIPTION:
${transcription}

Return a JSON object with EXACTLY this structure (no markdown, just JSON):
{
  "summary": "A brief 2-3 sentence summary of the call",
  "memberConcerns": ["Array of specific concerns or pain points mentioned by the member"],
  "memberPreferences": ["Array of preferences mentioned (location, budget, room type, etc.)"],
  "recommendedActions": ["Array of recommended follow-up actions for the agent"],
  "objections": ["Array of any hesitations or objections raised"],
  "moveInReadiness": "high" or "medium" or "low",
  "callSentiment": "positive" or "neutral" or "negative"
}

If a category has no relevant information, return an empty array [].
Focus on actionable insights that will help with follow-up conversations.`;

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
      console.error('Lovable AI error:', errorText);
      throw new Error(`AI summary error: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    const aiContent = aiResult.choices?.[0]?.message?.content || '';
    console.log('AI response received');

    // Parse the JSON response
    let keyPoints;
    let summary = '';
    try {
      // Clean up the response (remove markdown code blocks if present)
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
      
      keyPoints = JSON.parse(cleanedContent);
      summary = keyPoints.summary || '';
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      // Fallback structure
      keyPoints = {
        summary: 'Call transcription completed but AI summary parsing failed.',
        memberConcerns: [],
        memberPreferences: [],
        recommendedActions: ['Review transcription manually'],
        objections: [],
        moveInReadiness: 'medium',
        callSentiment: 'neutral'
      };
      summary = keyPoints.summary;
    }

    // Step 4: Update the booking with transcription data
    console.log('Updating booking with transcription data...');
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        call_transcription: transcription,
        call_summary: summary,
        call_key_points: keyPoints,
        transcription_status: 'completed',
        transcribed_at: new Date().toISOString(),
      })
      .eq('id', bookingId);

    if (updateError) {
      console.error('Update error:', updateError);
      throw new Error(`Failed to update booking: ${updateError.message}`);
    }

    console.log('Transcription completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        transcription,
        summary,
        keyPoints,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Transcription error:', error);
    
    // Try to update status to failed if we have bookingId
    try {
      const { bookingId } = await req.clone().json();
      if (bookingId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabase = createClient(supabaseUrl!, supabaseServiceKey!);
        await supabase
          .from('bookings')
          .update({ transcription_status: 'failed' })
          .eq('id', bookingId);
      }
    } catch (e) {
      console.error('Failed to update status to failed:', e);
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
