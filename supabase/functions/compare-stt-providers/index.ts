import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingId } = await req.json();
    
    if (!bookingId) {
      throw new Error('bookingId is required');
    }

    console.log(`Starting STT comparison for booking: ${bookingId}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const deepgramApiKey = Deno.env.get('DEEPGRAM_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch booking and existing transcription
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, member_name, kixie_link, agent_id')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error(`Booking not found: ${bookingError?.message}`);
    }

    const { data: transcription, error: transcError } = await supabase
      .from('booking_transcriptions')
      .select('call_transcription, stt_provider')
      .eq('booking_id', bookingId)
      .single();

    if (transcError || !transcription?.call_transcription) {
      throw new Error(`No existing transcription found: ${transcError?.message}`);
    }

    const existingTranscript = transcription.call_transcription;
    const existingProvider = transcription.stt_provider || 'elevenlabs (legacy)';

    console.log(`Found existing ${existingProvider} transcription: ${existingTranscript.length} chars`);

    // 2. Download audio file
    if (!booking.kixie_link) {
      throw new Error('No kixie_link found for this booking');
    }

    console.log(`Downloading audio from: ${booking.kixie_link}`);
    const audioResponse = await fetch(booking.kixie_link);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.status}`);
    }
    
    const audioBuffer = await audioResponse.arrayBuffer();
    const audioSize = audioBuffer.byteLength;
    console.log(`Downloaded audio: ${(audioSize / 1024 / 1024).toFixed(2)} MB`);

    // 3. Process with Deepgram Nova-2
    console.log('Processing with Deepgram Nova-2...');
    const deepgramStart = Date.now();

    const deepgramResponse = await fetch(
      'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&diarize=true&punctuate=true&paragraphs=true',
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${deepgramApiKey}`,
          'Content-Type': 'audio/mp3',
        },
        body: audioBuffer,
      }
    );

    if (!deepgramResponse.ok) {
      const errorText = await deepgramResponse.text();
      throw new Error(`Deepgram API error: ${deepgramResponse.status} - ${errorText}`);
    }

    const deepgramResult = await deepgramResponse.json();
    const deepgramProcessingTime = Date.now() - deepgramStart;
    
    console.log(`Deepgram processing completed in ${deepgramProcessingTime}ms`);

    // 4. Format Deepgram transcript with speaker diarization
    const words = deepgramResult.results?.channels?.[0]?.alternatives?.[0]?.words || [];
    const duration = deepgramResult.metadata?.duration || 0;
    
    let deepgramTranscript = '';
    let currentSpeaker = -1;
    let currentParagraph = '';

    for (const word of words) {
      const speaker = word.speaker ?? 0;
      
      if (speaker !== currentSpeaker) {
        if (currentParagraph.trim()) {
          const speakerLabel = currentSpeaker === 0 ? 'Agent' : 'Member';
          deepgramTranscript += `${speakerLabel}: ${currentParagraph.trim()}\n\n`;
        }
        currentSpeaker = speaker;
        currentParagraph = '';
      }
      
      currentParagraph += word.punctuated_word + ' ';
    }

    // Add final paragraph
    if (currentParagraph.trim()) {
      const speakerLabel = currentSpeaker === 0 ? 'Agent' : 'Member';
      deepgramTranscript += `${speakerLabel}: ${currentParagraph.trim()}\n\n`;
    }

    deepgramTranscript = deepgramTranscript.trim();

    // 5. Calculate comparison metrics
    const countWords = (text: string) => text.split(/\s+/).filter(w => w.length > 0).length;

    const elevenLabsStats = {
      charCount: existingTranscript.length,
      wordCount: countWords(existingTranscript),
      provider: existingProvider,
    };

    const deepgramStats = {
      charCount: deepgramTranscript.length,
      wordCount: countWords(deepgramTranscript),
      duration_seconds: Math.round(duration),
      processing_time_ms: deepgramProcessingTime,
      provider: 'deepgram_nova2',
    };

    const charDiff = Math.abs(elevenLabsStats.charCount - deepgramStats.charCount);
    const wordDiff = Math.abs(elevenLabsStats.wordCount - deepgramStats.wordCount);

    const response = {
      booking: {
        id: booking.id,
        memberName: booking.member_name,
        audioSizeMB: (audioSize / 1024 / 1024).toFixed(2),
      },
      elevenlabs: {
        ...elevenLabsStats,
        preview: existingTranscript.substring(0, 2000) + (existingTranscript.length > 2000 ? '...' : ''),
        fullTranscript: existingTranscript,
      },
      deepgram: {
        ...deepgramStats,
        preview: deepgramTranscript.substring(0, 2000) + (deepgramTranscript.length > 2000 ? '...' : ''),
        fullTranscript: deepgramTranscript,
      },
      comparison: {
        charDifference: charDiff,
        charDifferencePercent: ((charDiff / elevenLabsStats.charCount) * 100).toFixed(2) + '%',
        wordDifference: wordDiff,
        wordDifferencePercent: ((wordDiff / elevenLabsStats.wordCount) * 100).toFixed(2) + '%',
        durationMinutes: (duration / 60).toFixed(2),
      },
    };

    console.log('Comparison complete:', {
      elevenLabsChars: elevenLabsStats.charCount,
      deepgramChars: deepgramStats.charCount,
      charDiff: response.comparison.charDifferencePercent,
    });

    return new Response(JSON.stringify(response, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('STT Comparison error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
