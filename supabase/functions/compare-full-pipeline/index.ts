import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ComparisonResult {
  elevenlabs: ProviderResult;
  deepgram: ProviderResult;
  differences: {
    transcriptLengthDelta: number;
    transcriptLengthDeltaPercent: number;
    concernsMissedByDeepgram: string[];
    concernsExtraInDeepgram: string[];
    objectionsMissedByDeepgram: string[];
    objectionsExtraInDeepgram: string[];
    memberDetailsDifferences: Record<string, { elevenlabs: string | null; deepgram: string | null }>;
    coachingScoreDeltas: Record<string, number>;
    qaScoreDeltas: Record<string, number>;
    qaTotalDelta: number;
    qaPercentageDelta: number;
  };
}

interface ProviderResult {
  transcriptChars: number;
  transcriptWords: number;
  analysis: {
    summary: string;
    memberDetails: Record<string, unknown>;
    memberConcerns: string[];
    objections: string[];
    coachingScores: Record<string, number>;
  };
  qaScores: {
    categories: Record<string, number>;
    total: number;
    maxTotal: number;
    percentage: number;
  };
}

// Transcribe with Deepgram Nova-2
async function transcribeWithDeepgram(audioBuffer: ArrayBuffer): Promise<string> {
  const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY');
  if (!DEEPGRAM_API_KEY) throw new Error('DEEPGRAM_API_KEY not configured');

  console.log('Transcribing with Deepgram Nova-2...');
  
  const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&diarize=true&punctuate=true&utterances=true', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${DEEPGRAM_API_KEY}`,
      'Content-Type': 'audio/mpeg',
    },
    body: audioBuffer,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Deepgram API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  
  // Format with speaker diarization similar to ElevenLabs output
  let formattedTranscript = '';
  const utterances = result.results?.utterances || [];
  
  if (utterances.length > 0) {
    for (const utterance of utterances) {
      const speaker = utterance.speaker === 0 ? 'Agent' : 'Member';
      formattedTranscript += `${speaker}: ${utterance.transcript}\n\n`;
    }
  } else {
    // Fallback to channel alternatives if no utterances
    const channels = result.results?.channels || [];
    if (channels.length > 0 && channels[0].alternatives?.length > 0) {
      formattedTranscript = channels[0].alternatives[0].transcript || '';
    }
  }

  console.log(`Deepgram transcript: ${formattedTranscript.length} chars`);
  return formattedTranscript.trim();
}

// Run AI analysis (same prompt as transcribe-call)
async function runAIAnalysis(transcript: string, providerName: string): Promise<{
  summary: string;
  memberDetails: Record<string, unknown>;
  memberConcerns: string[];
  objections: string[];
  coachingScores: Record<string, number>;
}> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

  console.log(`Running AI analysis for ${providerName}...`);

  const prompt = `You are an expert sales call analyst for PadSplit, an affordable housing provider offering rooms in shared houses. Analyze this call transcription and provide structured feedback.

TRANSCRIPTION:
${transcript}

Provide your analysis in the following JSON format:
{
  "summary": "Brief 2-3 sentence summary of the call",
  "callDuration": "Estimated duration based on conversation length",
  "memberDetails": {
    "firstName": "Member's first name if mentioned",
    "lastName": "Member's last name if mentioned",
    "phoneNumber": "Phone number if mentioned",
    "email": "Email if mentioned",
    "householdSize": "Number of people if mentioned",
    "weeklyBudget": "Budget amount if mentioned",
    "moveInDate": "Preferred move-in date if mentioned",
    "commitmentWeeks": "Lease commitment if mentioned",
    "preferredPaymentMethod": "Payment method if mentioned",
    "propertyAddress": "Property address if mentioned"
  },
  "keyPoints": {
    "memberConcerns": ["List of specific concerns the member expressed"],
    "preferences": ["List of member's housing preferences"],
    "objections": ["List of objections raised by the member"],
    "sentiment": "positive/neutral/negative",
    "moveInReadiness": "ready/considering/not-ready",
    "marketCity": "City mentioned if any",
    "marketState": "State mentioned if any"
  },
  "agentFeedback": {
    "overallRating": "excellent/good/needs-improvement/poor",
    "strengths": ["List 2-3 specific things the agent did well"],
    "areasForImprovement": ["List 2-3 specific areas where the agent could improve"],
    "coachingTips": ["List 2-3 actionable coaching tips"],
    "scores": {
      "communication": 8,
      "productKnowledge": 7,
      "objectionHandling": 6,
      "closingSkills": 7
    }
  }
}

IMPORTANT: Return ONLY valid JSON, no markdown or additional text.`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: 'You are a sales call analyst. Return only valid JSON.' },
        { role: 'user', content: prompt }
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API error for ${providerName}: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  
  // Parse JSON from response
  let parsed;
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch (e) {
    console.error(`Failed to parse AI response for ${providerName}:`, e);
    parsed = {};
  }

  return {
    summary: parsed.summary || '',
    memberDetails: parsed.memberDetails || {},
    memberConcerns: parsed.keyPoints?.memberConcerns || [],
    objections: parsed.keyPoints?.objections || [],
    coachingScores: parsed.agentFeedback?.scores || {},
  };
}

// Run QA scoring (same prompt as generate-qa-scores)
async function runQAScoring(transcript: string, providerName: string): Promise<{
  categories: Record<string, number>;
  total: number;
  maxTotal: number;
  percentage: number;
}> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

  console.log(`Running QA scoring for ${providerName}...`);

  // Default QA rubric
  const categories = [
    { name: "Greeting & Introduction", maxPoints: 10, criteria: "Professional greeting, name introduction, company identification" },
    { name: "Needs Discovery", maxPoints: 15, criteria: "Asking about budget, move-in timeline, location preferences, household size" },
    { name: "Clarity & Product Knowledge", maxPoints: 20, criteria: "Clear explanation of PadSplit model, pricing, amenities, booking process" },
    { name: "Handling Objections", maxPoints: 15, criteria: "Addressing concerns about shared living, deposits, background checks" },
    { name: "Booking Support/CTA", maxPoints: 20, criteria: "Guiding through booking, payment options, next steps, sense of urgency" },
    { name: "Soft Skills & Tone", maxPoints: 10, criteria: "Empathy, patience, active listening, professional tone" }
  ];

  const rubricText = categories.map(c => `- ${c.name} (max ${c.maxPoints} points): ${c.criteria}`).join('\n');

  const prompt = `You are a Quality Assurance specialist for PadSplit sales calls. Score this call based on the following rubric:

QA RUBRIC:
${rubricText}

CALL TRANSCRIPTION:
${transcript}

Score each category from 0 to the maximum points. Provide scores in this exact JSON format:
{
  "scores": {
    "Greeting & Introduction": <0-10>,
    "Needs Discovery": <0-15>,
    "Clarity & Product Knowledge": <0-20>,
    "Handling Objections": <0-15>,
    "Booking Support/CTA": <0-20>,
    "Soft Skills & Tone": <0-10>
  }
}

IMPORTANT: Return ONLY valid JSON with numeric scores, no explanations.`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: 'You are a QA specialist. Return only valid JSON with numeric scores.' },
        { role: 'user', content: prompt }
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`QA API error for ${providerName}: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  
  let parsed;
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch (e) {
    console.error(`Failed to parse QA response for ${providerName}:`, e);
    parsed = {};
  }

  const scores = parsed.scores || {};
  const maxTotal = 90;
  let total = 0;
  
  // Cap scores within limits
  const categoryScores: Record<string, number> = {};
  for (const cat of categories) {
    const score = Math.min(Math.max(0, scores[cat.name] || 0), cat.maxPoints);
    categoryScores[cat.name] = score;
    total += score;
  }

  return {
    categories: categoryScores,
    total,
    maxTotal,
    percentage: Math.round((total / maxTotal) * 100),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingId } = await req.json();
    
    if (!bookingId) {
      return new Response(JSON.stringify({ error: 'bookingId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Starting full pipeline comparison for booking: ${bookingId}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch booking and existing transcription
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, kixie_link, member_name')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error(`Booking not found: ${bookingError?.message}`);
    }

    const { data: transcription, error: txError } = await supabase
      .from('booking_transcriptions')
      .select('call_transcription, stt_provider')
      .eq('booking_id', bookingId)
      .single();

    if (txError || !transcription?.call_transcription) {
      throw new Error(`No existing transcription found: ${txError?.message}`);
    }

    const elevenlabsTranscript = transcription.call_transcription;
    console.log(`Found ElevenLabs transcript: ${elevenlabsTranscript.length} chars`);

    // 2. Download audio and transcribe with Deepgram
    if (!booking.kixie_link) {
      throw new Error('No Kixie link found for this booking');
    }

    console.log('Downloading audio from Kixie...');
    const audioResponse = await fetch(booking.kixie_link);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.status}`);
    }
    const audioBuffer = await audioResponse.arrayBuffer();
    console.log(`Downloaded audio: ${audioBuffer.byteLength} bytes`);

    const deepgramTranscript = await transcribeWithDeepgram(audioBuffer);

    // 3. Run AI analysis on both transcripts (in parallel)
    console.log('Running AI analysis on both transcripts...');
    const [elevenlabsAnalysis, deepgramAnalysis] = await Promise.all([
      runAIAnalysis(elevenlabsTranscript, 'ElevenLabs'),
      runAIAnalysis(deepgramTranscript, 'Deepgram'),
    ]);

    // 4. Run QA scoring on both transcripts (in parallel)
    console.log('Running QA scoring on both transcripts...');
    const [elevenlabsQA, deepgramQA] = await Promise.all([
      runQAScoring(elevenlabsTranscript, 'ElevenLabs'),
      runQAScoring(deepgramTranscript, 'Deepgram'),
    ]);

    // 5. Calculate differences
    const elConcerns = new Set(elevenlabsAnalysis.memberConcerns.map(c => c.toLowerCase()));
    const dgConcerns = new Set(deepgramAnalysis.memberConcerns.map(c => c.toLowerCase()));
    const concernsMissed = elevenlabsAnalysis.memberConcerns.filter(c => !dgConcerns.has(c.toLowerCase()));
    const concernsExtra = deepgramAnalysis.memberConcerns.filter(c => !elConcerns.has(c.toLowerCase()));

    const elObjections = new Set(elevenlabsAnalysis.objections.map(o => o.toLowerCase()));
    const dgObjections = new Set(deepgramAnalysis.objections.map(o => o.toLowerCase()));
    const objectionsMissed = elevenlabsAnalysis.objections.filter(o => !dgObjections.has(o.toLowerCase()));
    const objectionsExtra = deepgramAnalysis.objections.filter(o => !elObjections.has(o.toLowerCase()));

    // Member details differences
    const memberDetailsDiffs: Record<string, { elevenlabs: string | null; deepgram: string | null }> = {};
    const allKeys = new Set([
      ...Object.keys(elevenlabsAnalysis.memberDetails),
      ...Object.keys(deepgramAnalysis.memberDetails)
    ]);
    for (const key of allKeys) {
      const elVal = String(elevenlabsAnalysis.memberDetails[key] || '');
      const dgVal = String(deepgramAnalysis.memberDetails[key] || '');
      if (elVal !== dgVal && (elVal || dgVal)) {
        memberDetailsDiffs[key] = { elevenlabs: elVal || null, deepgram: dgVal || null };
      }
    }

    // Coaching score deltas
    const coachingScoreDeltas: Record<string, number> = {};
    const allCoachingKeys = new Set([
      ...Object.keys(elevenlabsAnalysis.coachingScores),
      ...Object.keys(deepgramAnalysis.coachingScores)
    ]);
    for (const key of allCoachingKeys) {
      const elScore = elevenlabsAnalysis.coachingScores[key] || 0;
      const dgScore = deepgramAnalysis.coachingScores[key] || 0;
      if (elScore !== dgScore) {
        coachingScoreDeltas[key] = dgScore - elScore;
      }
    }

    // QA score deltas
    const qaScoreDeltas: Record<string, number> = {};
    for (const cat of Object.keys(elevenlabsQA.categories)) {
      const elScore = elevenlabsQA.categories[cat] || 0;
      const dgScore = deepgramQA.categories[cat] || 0;
      if (elScore !== dgScore) {
        qaScoreDeltas[cat] = dgScore - elScore;
      }
    }

    const result: ComparisonResult = {
      elevenlabs: {
        transcriptChars: elevenlabsTranscript.length,
        transcriptWords: elevenlabsTranscript.split(/\s+/).length,
        analysis: {
          summary: elevenlabsAnalysis.summary,
          memberDetails: elevenlabsAnalysis.memberDetails,
          memberConcerns: elevenlabsAnalysis.memberConcerns,
          objections: elevenlabsAnalysis.objections,
          coachingScores: elevenlabsAnalysis.coachingScores,
        },
        qaScores: elevenlabsQA,
      },
      deepgram: {
        transcriptChars: deepgramTranscript.length,
        transcriptWords: deepgramTranscript.split(/\s+/).length,
        analysis: {
          summary: deepgramAnalysis.summary,
          memberDetails: deepgramAnalysis.memberDetails,
          memberConcerns: deepgramAnalysis.memberConcerns,
          objections: deepgramAnalysis.objections,
          coachingScores: deepgramAnalysis.coachingScores,
        },
        qaScores: deepgramQA,
      },
      differences: {
        transcriptLengthDelta: deepgramTranscript.length - elevenlabsTranscript.length,
        transcriptLengthDeltaPercent: Math.round(((deepgramTranscript.length - elevenlabsTranscript.length) / elevenlabsTranscript.length) * 100),
        concernsMissedByDeepgram: concernsMissed,
        concernsExtraInDeepgram: concernsExtra,
        objectionsMissedByDeepgram: objectionsMissed,
        objectionsExtraInDeepgram: objectionsExtra,
        memberDetailsDifferences: memberDetailsDiffs,
        coachingScoreDeltas,
        qaScoreDeltas,
        qaTotalDelta: deepgramQA.total - elevenlabsQA.total,
        qaPercentageDelta: deepgramQA.percentage - elevenlabsQA.percentage,
      },
    };

    console.log('Comparison complete!');
    console.log(`Transcript delta: ${result.differences.transcriptLengthDeltaPercent}%`);
    console.log(`QA total delta: ${result.differences.qaTotalDelta} points (${result.differences.qaPercentageDelta}%)`);

    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in compare-full-pipeline:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
