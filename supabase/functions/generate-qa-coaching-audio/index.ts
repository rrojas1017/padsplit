import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QACategory {
  name: string;
  maxPoints: number;
  description?: string;
  criteria?: string;
}

interface QAScores {
  scores: Record<string, number>;
  total: number;
  maxTotal: number;
  percentage: number;
  rubricId: string;
  scoredAt: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingId, isRegenerate = false } = await req.json();
    
    if (!bookingId) {
      throw new Error('bookingId is required');
    }

    console.log(`Generating QA coaching audio for booking: ${bookingId}, isRegenerate: ${isRegenerate}`);

    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!ELEVENLABS_API_KEY || !LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch booking with transcription data
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id,
        member_name,
        agent_id,
        booking_date,
        agents!inner(id, name)
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error(`Failed to fetch booking: ${bookingError?.message}`);
    }

    // Fetch transcription with QA scores
    const { data: transcription, error: transcriptionError } = await supabase
      .from('booking_transcriptions')
      .select('*')
      .eq('booking_id', bookingId)
      .single();

    if (transcriptionError || !transcription) {
      throw new Error(`Failed to fetch transcription: ${transcriptionError?.message}`);
    }

    if (!transcription.qa_scores) {
      throw new Error('No QA scores found for this booking');
    }

    const qaScores = transcription.qa_scores as QAScores;

    // Fetch active QA rubric
    const { data: qaSettings, error: qaSettingsError } = await supabase
      .from('qa_settings')
      .select('*')
      .eq('is_active', true)
      .single();

    if (qaSettingsError || !qaSettings) {
      console.log('No active QA rubric found, using default categories');
    }

    const categories: QACategory[] = qaSettings?.categories || [
      { name: 'Greeting & Introduction', maxPoints: 10 },
      { name: 'Needs Discovery', maxPoints: 15 },
      { name: 'Clarity & Product Knowledge', maxPoints: 20 },
      { name: 'Handling Objections', maxPoints: 15 },
      { name: 'Booking Support/CTA', maxPoints: 20 },
      { name: 'Soft Skills & Tone', maxPoints: 10 }
    ];

    // Fetch QA coaching settings
    const { data: coachingSettings } = await supabase
      .from('qa_coaching_settings')
      .select('*')
      .eq('is_active', true)
      .single();

    const voiceId = coachingSettings?.voice_id || 'EXAVITQu4vr4xnSDxMaL'; // Sarah
    const coachingTone = coachingSettings?.coaching_tone || 'empathetic';
    const maxLengthSeconds = coachingSettings?.max_audio_length_seconds || 60;
    const alwaysEmphasize = coachingSettings?.always_emphasize || [];
    const neverMention = coachingSettings?.never_mention || [];

    // Calculate category scores with percentages
    const categoryResults: { name: string; score: number; maxPoints: number; percentage: number; criteria?: string }[] = [];
    
    for (const category of categories) {
      const score = qaScores.scores[category.name] || 0;
      const percentage = Math.round((score / category.maxPoints) * 100);
      categoryResults.push({
        name: category.name,
        score,
        maxPoints: category.maxPoints,
        percentage,
        criteria: category.criteria || category.description
      });
    }

    // Sort by percentage to find weakest areas (lowest scores)
    const sortedCategories = [...categoryResults].sort((a, b) => a.percentage - b.percentage);
    const weakestAreas = sortedCategories.slice(0, 3).filter(c => c.percentage < 80);

    const agentName = (booking.agents as any).name;
    const memberName = booking.member_name;

    // Calculate max words based on seconds (approx 2.5 words per second for natural speech)
    const maxWords = Math.round(maxLengthSeconds * 2.5);

    // Build Katty's empathetic prompt
    const kattyPrompt = `You are Katty, a warm, empathetic, and supportive QA coach. Your role is to help sales agents improve their call quality through constructive, caring feedback. You have a natural, conversational female voice.

AGENT NAME: ${agentName}
MEMBER/CUSTOMER: ${memberName}

OVERALL QA SCORE: ${qaScores.percentage}% (${qaScores.total}/${qaScores.maxTotal} points)

ALL CATEGORY SCORES:
${categoryResults.map(c => `- ${c.name}: ${c.score}/${c.maxPoints} (${c.percentage}%)${c.criteria ? ` - Expected: ${c.criteria}` : ''}`).join('\n')}

AREAS NEEDING MOST IMPROVEMENT:
${weakestAreas.length > 0 ? weakestAreas.map(c => `- ${c.name}: Only ${c.percentage}% achieved (${c.score}/${c.maxPoints} points)${c.criteria ? `\n  What was expected: ${c.criteria}` : ''}`).join('\n') : 'Great job! All areas scored well.'}

${transcription.call_summary ? `CALL SUMMARY:\n${transcription.call_summary}` : ''}

${alwaysEmphasize.length > 0 ? `ALWAYS MENTION THESE TOPICS:\n${alwaysEmphasize.join(', ')}` : ''}

${neverMention.length > 0 ? `NEVER MENTION THESE TOPICS:\n${neverMention.join(', ')}` : ''}

YOUR COACHING MUST:
1. Start warmly - "Hey ${agentName}, it's Katty. I wanted to chat with you about your call with ${memberName}..."
2. Be genuine and empathetic - acknowledge this is about growth, not criticism
3. If they did well overall (80%+), celebrate that first
4. Focus specifically on the ${weakestAreas.length} weakest categories BY THEIR EXACT NAME:
   ${weakestAreas.map(c => `- Specifically mention "${c.name}" - explain why it matters and give one concrete tip`).join('\n   ')}
5. End with encouragement - you believe in them and know they can improve

CRITICAL REQUIREMENTS:
- ALWAYS mention the specific QA category names (like "${weakestAreas[0]?.name || 'Greeting & Introduction'}") so there's no confusion
- Be specific about what they could do differently next time
- Keep it conversational, like a mentor talking to a colleague they care about
- Tone: ${coachingTone}, warm, supportive - never harsh or critical
- Maximum length: ${maxWords} words (about ${maxLengthSeconds} seconds when spoken)

Generate ONLY the spoken script. No formatting, no quotes, no stage directions.`;

    console.log('Generating QA coaching script with Lovable AI...');

    // Generate script using Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are Katty, an empathetic QA coach. Generate only the spoken coaching script, nothing else.' },
          { role: 'user', content: kattyPrompt }
        ],
        max_tokens: 500,
        temperature: 0.7
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const coachingScript = aiData.choices?.[0]?.message?.content?.trim();

    if (!coachingScript) {
      throw new Error('No coaching script generated');
    }

    console.log('Generated QA coaching script:', coachingScript.substring(0, 100) + '...');

    // Generate audio with ElevenLabs using Sarah's voice
    console.log(`Generating audio with ElevenLabs voice: ${voiceId}`);
    
    const elevenLabsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: coachingScript,
        model_id: 'eleven_turbo_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
          style: 0.4, // Slightly expressive for empathy
          use_speaker_boost: true
        }
      }),
    });

    if (!elevenLabsResponse.ok) {
      const errorText = await elevenLabsResponse.text();
      console.error('ElevenLabs error:', elevenLabsResponse.status, errorText);
      throw new Error(`ElevenLabs API error: ${elevenLabsResponse.status}`);
    }

    const audioBuffer = await elevenLabsResponse.arrayBuffer();
    const audioData = new Uint8Array(audioBuffer);

    console.log('Audio generated, uploading to storage...');

    // Upload to Supabase Storage
    const fileName = `qa-coaching-${bookingId}-${Date.now()}.mp3`;
    
    const { error: uploadError } = await supabase.storage
      .from('coaching-audio')
      .upload(fileName, audioData, {
        contentType: 'audio/mpeg',
        upsert: true
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw new Error(`Failed to upload audio: ${uploadError.message}`);
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('coaching-audio')
      .getPublicUrl(fileName);

    const audioUrl = publicUrlData.publicUrl;

    console.log('Audio uploaded, URL:', audioUrl);

    // Update booking_transcriptions with QA coaching audio
    const updateData: Record<string, any> = {
      qa_coaching_audio_url: audioUrl,
      qa_coaching_audio_generated_at: new Date().toISOString(),
    };

    if (isRegenerate) {
      // Keep the original generated_at, just update the URL
      updateData.qa_coaching_audio_generated_at = transcription.qa_coaching_audio_generated_at || new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('booking_transcriptions')
      .update(updateData)
      .eq('booking_id', bookingId);

    if (updateError) {
      console.error('Failed to update transcription:', updateError);
      throw new Error(`Failed to update transcription: ${updateError.message}`);
    }

    console.log('QA coaching audio generated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        audioUrl,
        script: coachingScript,
        weakestAreas: weakestAreas.map(c => c.name)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating QA coaching audio:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
