import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface STTResult {
  transcription: string;
  words: Array<{ text: string; start: number; end: number; speaker_id?: string }>;
  durationSeconds: number;
  confidence?: number;
  latencyMs: number;
  wordCount: number;
}

// Transcribe with ElevenLabs Scribe v1
async function transcribeWithElevenLabs(
  audioBlob: Blob,
  apiKey: string
): Promise<STTResult> {
  const startTime = Date.now();
  
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.wav');
  formData.append('model_id', 'scribe_v1');
  formData.append('diarize', 'true');
  formData.append('language_code', 'eng');
  formData.append('tag_audio_events', 'true');

  const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: formData,
  });

  const latencyMs = Date.now() - startTime;

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const words = result.words || [];
  const lastWord = words[words.length - 1];
  const durationSeconds = lastWord?.end ? Math.ceil(lastWord.end) : 0;

  return {
    transcription: result.text || '',
    words,
    durationSeconds,
    confidence: undefined,
    latencyMs,
    wordCount: words.length,
  };
}

// Transcribe with Deepgram Nova-2
async function transcribeWithDeepgram(
  audioBlob: Blob,
  apiKey: string
): Promise<STTResult> {
  const startTime = Date.now();

  const response = await fetch(
    'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&diarize=true&language=en-US&punctuate=true',
    {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'audio/wav',
      },
      body: audioBlob,
    }
  );

  const latencyMs = Date.now() - startTime;

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Deepgram API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const channel = result.results?.channels?.[0];
  const alternative = channel?.alternatives?.[0];

  if (!alternative) {
    throw new Error('Deepgram returned no transcription results');
  }

  const words = (alternative.words || []).map((w: any) => ({
    text: w.word || w.punctuated_word || '',
    start: w.start,
    end: w.end,
    speaker_id: w.speaker !== undefined ? `speaker_${w.speaker}` : undefined,
  }));

  const durationSeconds = result.metadata?.duration 
    ? Math.ceil(result.metadata.duration)
    : (words.length > 0 ? Math.ceil(words[words.length - 1].end) : 0);

  return {
    transcription: alternative.transcript || '',
    words,
    durationSeconds,
    confidence: alternative.confidence,
    latencyMs,
    wordCount: words.length,
  };
}

// Download audio file
async function downloadAudio(kixieUrl: string): Promise<{ blob: Blob; sizeMB: number }> {
  console.log('[Compare] Downloading audio from:', kixieUrl);
  
  const audioResponse = await fetch(kixieUrl, {
    headers: {
      'Accept': 'audio/*',
      'User-Agent': 'Mozilla/5.0 (compatible; TranscriptionBot/1.0)',
    },
  });

  if (!audioResponse.ok) {
    throw new Error(`Failed to download audio: ${audioResponse.status}`);
  }

  const audioData = await audioResponse.arrayBuffer();
  const sizeMB = audioData.byteLength / (1024 * 1024);
  console.log(`[Compare] Audio downloaded: ${sizeMB.toFixed(2)} MB`);
  
  return {
    blob: new Blob([audioData], { type: 'audio/wav' }),
    sizeMB,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingId, kixieUrl } = await req.json();
    
    if (!kixieUrl) {
      throw new Error('Missing kixieUrl parameter');
    }

    // Get API keys
    const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
    const deepgramApiKey = Deno.env.get('DEEPGRAM_API_KEY');
    
    if (!elevenLabsApiKey) {
      throw new Error('ELEVENLABS_API_KEY not configured');
    }
    if (!deepgramApiKey) {
      throw new Error('DEEPGRAM_API_KEY not configured');
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[Compare] Starting side-by-side comparison for booking ${bookingId || 'N/A'}`);

    // Download audio once
    const { blob: audioBlob, sizeMB } = await downloadAudio(kixieUrl);

    // Run both providers in parallel
    console.log('[Compare] Running both STT providers in parallel...');
    const [elevenlabsResult, deepgramResult] = await Promise.allSettled([
      transcribeWithElevenLabs(audioBlob, elevenLabsApiKey),
      transcribeWithDeepgram(audioBlob, deepgramApiKey),
    ]);

    // Extract results (handle errors gracefully)
    const elevenlabs = elevenlabsResult.status === 'fulfilled' ? elevenlabsResult.value : null;
    const deepgram = deepgramResult.status === 'fulfilled' ? deepgramResult.value : null;

    if (elevenlabsResult.status === 'rejected') {
      console.error('[Compare] ElevenLabs failed:', elevenlabsResult.reason);
    }
    if (deepgramResult.status === 'rejected') {
      console.error('[Compare] Deepgram failed:', deepgramResult.reason);
    }

    // Calculate call duration from whichever succeeded
    const callDurationSeconds = elevenlabs?.durationSeconds || deepgram?.durationSeconds || 0;

    // Build comparison record
    const comparisonData = {
      booking_id: bookingId || null,
      kixie_link: kixieUrl,
      
      // ElevenLabs
      elevenlabs_transcription: elevenlabs?.transcription || null,
      elevenlabs_word_count: elevenlabs?.wordCount || null,
      elevenlabs_char_count: elevenlabs?.transcription?.length || null,
      elevenlabs_latency_ms: elevenlabs?.latencyMs || null,
      elevenlabs_confidence: null, // ElevenLabs doesn't provide overall confidence
      
      // Deepgram
      deepgram_transcription: deepgram?.transcription || null,
      deepgram_word_count: deepgram?.wordCount || null,
      deepgram_char_count: deepgram?.transcription?.length || null,
      deepgram_latency_ms: deepgram?.latencyMs || null,
      deepgram_confidence: deepgram?.confidence || null,
      
      // Metadata
      call_duration_seconds: callDurationSeconds,
      audio_file_size_mb: sizeMB,
      comparison_notes: `ElevenLabs: ${elevenlabsResult.status}, Deepgram: ${deepgramResult.status}`,
    };

    // Store comparison
    const { data, error } = await supabase
      .from('stt_quality_comparisons')
      .insert(comparisonData)
      .select()
      .single();

    if (error) {
      console.error('[Compare] Failed to save comparison:', error);
      throw new Error(`Failed to save comparison: ${error.message}`);
    }

    console.log('[Compare] Comparison saved:', data.id);

    // Calculate quality metrics
    const durationMinutes = callDurationSeconds / 60;
    const elevenlabsCharsPerMin = elevenlabs ? (elevenlabs.transcription.length / durationMinutes) : 0;
    const deepgramCharsPerMin = deepgram ? (deepgram.transcription.length / durationMinutes) : 0;
    const elevenlabsCost = durationMinutes * 0.034;
    const deepgramCost = durationMinutes * 0.0043;

    return new Response(
      JSON.stringify({
        success: true,
        comparisonId: data.id,
        metrics: {
          callDurationSeconds,
          audioSizeMB: sizeMB,
          elevenlabs: elevenlabs ? {
            wordCount: elevenlabs.wordCount,
            charCount: elevenlabs.transcription.length,
            latencyMs: elevenlabs.latencyMs,
            charsPerMinute: Math.round(elevenlabsCharsPerMin),
            estimatedCost: `$${elevenlabsCost.toFixed(4)}`,
          } : { error: 'Failed to transcribe' },
          deepgram: deepgram ? {
            wordCount: deepgram.wordCount,
            charCount: deepgram.transcription.length,
            latencyMs: deepgram.latencyMs,
            confidence: deepgram.confidence,
            charsPerMinute: Math.round(deepgramCharsPerMin),
            estimatedCost: `$${deepgramCost.toFixed(4)}`,
          } : { error: 'Failed to transcribe' },
          costSavings: elevenlabs && deepgram 
            ? `$${(elevenlabsCost - deepgramCost).toFixed(4)} (${Math.round((1 - deepgramCost/elevenlabsCost) * 100)}% savings with Deepgram)`
            : 'N/A',
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Compare] Error:', error);
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
