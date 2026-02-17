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

// === HARD-WIRED COST PROTECTION CONSTANTS ===
const MAX_COST_PER_RECORD_NO_TTS = 0.07; // USD - absolute ceiling per record (excluding TTS)
const ROLLING_AVERAGE_WINDOW = 20; // number of recent records to check

// STT Provider types
type STTProviderName = 'elevenlabs' | 'deepgram';

// Model selection threshold (5 minutes = 300 seconds)
const ANALYSIS_MODEL_THRESHOLD_SECONDS = 300;

// Select AI model based on call duration for cost optimization
function selectAnalysisModel(callDurationSeconds: number | null): string {
  if (!callDurationSeconds || callDurationSeconds < ANALYSIS_MODEL_THRESHOLD_SECONDS) {
    console.log(`[Model] Using Flash for ${callDurationSeconds || 0}s call (< 5 min threshold)`);
    return 'google/gemini-2.5-flash';
  }
  
  console.log(`[Model] Using Pro for ${callDurationSeconds}s call (≥ 5 min threshold)`);
  return 'google/gemini-2.5-pro';
}

interface STTResult {
  transcription: string;
  words: Array<{ text: string; start: number; end: number; speaker_id?: string }>;
  durationSeconds: number;
  confidence?: number;
  latencyMs: number;
  wordCount: number;
}

// Validate if a transcription contains a real two-way conversation
// Returns false for voicemails, failed connections, or one-sided recordings
function validateConversation(params: {
  durationSeconds: number | null;
  transcription: string;
  summary: string;
}): boolean {
  const { durationSeconds, transcription, summary } = params;
  const lowerTranscription = transcription.toLowerCase();
  const lowerSummary = summary.toLowerCase();
  
  // Voicemail indicators in transcription
  const voicemailIndicators = [
    'forwarded to voicemail',
    'leave your message',
    'leave a message',
    'not available',
    'at the tone',
    'please record your message',
    'mailbox is full',
    'record your message at the tone',
    'the person you are calling',
    'is not available right now',
    'after the beep',
    'voice mailbox'
  ];
  
  // AI detected no real conversation
  const noConversationIndicators = [
    'no actual conversation',
    'voicemail recording',
    'no discussion',
    'no conversation took place',
    'no contact was made',
    'voicemail greeting',
    'failed to connect',
    'no meaningful dialogue',
    'no two-way conversation',
    'one-sided recording',
    'automated voicemail'
  ];
  
  // Short calls (<30s) with voicemail keywords are almost certainly voicemails
  if (durationSeconds && durationSeconds < 30) {
    if (voicemailIndicators.some(indicator => lowerTranscription.includes(indicator))) {
      console.log('[Validation] Short call with voicemail indicator detected');
      return false;
    }
  }
  
  // Check if AI summary indicates no real conversation
  if (noConversationIndicators.some(indicator => lowerSummary.includes(indicator))) {
    console.log('[Validation] AI summary indicates no real conversation');
    return false;
  }
  
  // Also check transcription for these indicators (sometimes in longer recordings)
  if (noConversationIndicators.some(indicator => lowerTranscription.includes(indicator))) {
    console.log('[Validation] Transcription indicates no real conversation');
    return false;
  }
  
  return true;
}

// ===== PAIN POINT ISSUE CLASSIFIER =====
const ISSUE_KEYWORDS_MAP: Record<string, string[]> = {
  'Payment & Pricing Confusion': ['promo code', 'deposit', 'weekly rate', 'how much', 'move-in cost', 'coupon', 'discount', 'billing', 'pricing', 'overcharged', 'hidden fee', 'price confused', 'not sure about the price', 'weekly payment', 'first week'],
  'Booking Process Issues': ['how to book', 'confus', 'trouble booking', "can't figure out", 'hard to navigate', 'stuck on', 'book a room', 'reserve'],
  'Host & Approval Concerns': ['approval', 'approv', 'reject', 'landlord', 'denied', 'pending approval', "haven't heard back", 'no response', 'still waiting', 'property manager'],
  'Trust & Legitimacy': ['scam', 'legit', 'trust', 'fraud', 'concern about company', 'suspicious', 'legitimate', 'sketchy', 'too good to be true', 'is this a scam', 'can i trust', 'is this real', 'reviews', 'reputation'],
  'Transportation Barriers': ['transport', 'bus', 'transit', 'commute', 'far from', 'too far', 'close to work', 'near work', 'no transportation', "can't get there", 'public transit'],
  'Move-In Barriers': ['background check', 'credit check', 'screening', 'eviction', 'when can i move', 'criminal', 'failed background', 'denied screening', 'move-in', 'move in'],
  'Property & Amenity Mismatch': ['noisy', 'neighborhood', 'too small', "doesn't have", 'no parking', 'not what i expected', 'wrong room', 'amenity'],
  'Financial Constraints': ['budget', "can't afford", 'too expensive', 'unemploy', 'cheaper', 'low income', 'fixed income', 'disability', 'ssi', 'ssdi', 'not enough money', "can't pay"],
};

interface DetectedIssueDetail {
  issue: string;
  matchingKeywords: string[];
  matchingConcerns: string[];
}

function classifyIssuesFromKeyPoints(keyPoints: any): DetectedIssueDetail[] {
  const concerns: string[] = keyPoints?.memberConcerns || [];
  const objections: string[] = keyPoints?.objections || [];
  const allSources = [...concerns, ...objections];
  const allText = allSources.join(' ').toLowerCase();
  if (!allText.trim()) return [];
  const detected: DetectedIssueDetail[] = [];
  for (const [category, keywords] of Object.entries(ISSUE_KEYWORDS_MAP)) {
    const matchedKeywords = keywords.filter(kw => allText.includes(kw));
    if (matchedKeywords.length >= 2) {
      const matchingConcerns = allSources.filter(source => {
        const lower = source.toLowerCase();
        return matchedKeywords.some(kw => lower.includes(kw));
      });
      detected.push({
        issue: category,
        matchingKeywords: matchedKeywords,
        matchingConcerns: [...new Set(matchingConcerns)],
      });
    }
  }
  return detected;
}

// Provider pricing constants (per minute)
const STT_PRICING: Record<STTProviderName, number> = {
  elevenlabs: 0.034,  // ElevenLabs Pro Plan
  deepgram: 0.0043,   // Deepgram Nova-2
};

// LLM Provider types for hybrid selection
type LLMProviderName = 'lovable_ai' | 'deepseek';

interface LLMProviderSelection {
  provider: LLMProviderName;
  model: string;
  fallbackReason?: string;
}

// DeepSeek pricing: $0.14/1M input, $0.28/1M output (cache miss)
const DEEPSEEK_PRICING = {
  inputRate: 0.00000014,   // $0.14 per 1M tokens
  outputRate: 0.00000028,  // $0.28 per 1M tokens
};

// Fetch provider-specific prompt enhancements from database
async function getProviderPromptEnhancements(
  supabase: any, 
  providerName: 'deepseek' | 'lovable_ai'
): Promise<string> {
  try {
    const { data: enhancements, error } = await supabase
      .from('llm_prompt_enhancements')
      .select('content')
      .eq('provider_name', providerName)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (error || !enhancements || enhancements.length === 0) {
      console.log(`[LLM Enhance] No active enhancements for ${providerName}`);
      return '';
    }

    const combinedEnhancements = enhancements.map((e: any) => e.content).join('\n\n');
    console.log(`[LLM Enhance] Loaded ${enhancements.length} enhancements for ${providerName} (${combinedEnhancements.length} chars)`);
    return combinedEnhancements;
  } catch (error) {
    console.error('[LLM Enhance] Error fetching enhancements:', error);
    return '';
  }
}

// Select LLM provider based on weights and fallback conditions
async function selectLLMProvider(
  supabase: any,
  bookingStatus: string | null,
  callDurationSeconds: number | null
): Promise<LLMProviderSelection> {
  try {
    // Fetch LLM provider settings
    const { data: settings, error } = await supabase
      .from('llm_provider_settings')
      .select('provider_name, weight, api_config')
      .eq('is_active', true);

    if (error) {
      console.log('[LLM A/B] Error fetching settings, defaulting to Gemini:', error);
      return { provider: 'lovable_ai', model: selectAnalysisModel(callDurationSeconds) };
    }

    const deepseekSettings = settings?.find((s: any) => s.provider_name === 'deepseek');
    const geminiSettings = settings?.find((s: any) => s.provider_name === 'lovable_ai');

    const deepseekWeight = deepseekSettings?.weight || 0;
    const geminiWeight = geminiSettings?.weight || 100;

    // Check fallback conditions from DeepSeek's api_config
    const fallbackConditions: string[] = deepseekSettings?.api_config?.use_gemini_fallback_for || [];
    const isNonBooking = bookingStatus === 'Non Booking';

    // If DeepSeek has 100% weight but this is a non-booking call, use Gemini fallback
    if (isNonBooking && fallbackConditions.includes('non_booking') && deepseekWeight > 0) {
      console.log('[LLM A/B] Non-booking call detected, falling back to Gemini for quality');
      return {
        provider: 'lovable_ai',
        model: selectAnalysisModel(callDurationSeconds),
        fallbackReason: 'non_booking'
      };
    }

    // Weight-based selection
    const totalWeight = deepseekWeight + geminiWeight;
    if (totalWeight === 0 || deepseekWeight === 0) {
      console.log('[LLM A/B] DeepSeek weight is 0, using Gemini');
      return { provider: 'lovable_ai', model: selectAnalysisModel(callDurationSeconds) };
    }

    if (geminiWeight === 0) {
      console.log('[LLM A/B] Gemini weight is 0, using DeepSeek');
      return { provider: 'deepseek', model: 'deepseek-chat' };
    }

    // Random selection based on weights
    const random = Math.random() * totalWeight;
    if (random < deepseekWeight) {
      console.log(`[LLM A/B] Selected DeepSeek (weight: ${deepseekWeight}/${totalWeight})`);
      return { provider: 'deepseek', model: 'deepseek-chat' };
    }

    console.log(`[LLM A/B] Selected Gemini (weight: ${geminiWeight}/${totalWeight})`);
    return { provider: 'lovable_ai', model: selectAnalysisModel(callDurationSeconds) };
  } catch (error) {
    console.error('[LLM A/B] Error selecting provider:', error);
    return { provider: 'lovable_ai', model: selectAnalysisModel(callDurationSeconds) };
  }
}

// Call DeepSeek API for analysis
async function callDeepSeekForAnalysis(
  systemPrompt: string,
  userPrompt: string
): Promise<{
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}> {
  const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY');
  if (!DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY not configured');

  const startTime = Date.now();
  
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      stream: false,
    }),
  });

  const latencyMs = Date.now() - startTime;

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content || '';
  const inputTokens = result.usage?.prompt_tokens || Math.ceil(userPrompt.length / 4);
  const outputTokens = result.usage?.completion_tokens || Math.ceil(content.length / 4);

  console.log(`[DeepSeek] Response received: ${inputTokens} input, ${outputTokens} output, ${latencyMs}ms`);

  return {
    content,
    model: result.model || 'deepseek-chat',
    inputTokens,
    outputTokens,
    latencyMs,
  };
}

// Cost logging helper function
async function logApiCost(supabase: any, params: {
  service_provider: 'elevenlabs' | 'deepgram' | 'lovable_ai' | 'deepseek';
  service_type: string;
  edge_function: string;
  booking_id?: string;
  agent_id?: string;
  site_id?: string;
  input_tokens?: number;
  output_tokens?: number;
  audio_duration_seconds?: number;
  character_count?: number;
  metadata?: Record<string, any>;
  triggered_by_user_id?: string;
  is_internal?: boolean;
}) {
  try {
    let cost = 0;
    
    if (params.service_provider === 'elevenlabs') {
      if (params.audio_duration_seconds) {
        cost = (params.audio_duration_seconds / 60) * STT_PRICING.elevenlabs;
      }
      if (params.character_count) {
        cost = params.character_count * 0.00015;
      }
    } else if (params.service_provider === 'deepgram') {
      if (params.audio_duration_seconds) {
        cost = (params.audio_duration_seconds / 60) * STT_PRICING.deepgram;
      }
    } else if (params.service_provider === 'deepseek') {
      const inputCost = (params.input_tokens || 0) * DEEPSEEK_PRICING.inputRate;
      const outputCost = (params.output_tokens || 0) * DEEPSEEK_PRICING.outputRate;
      cost = inputCost + outputCost;
    } else if (params.service_provider === 'lovable_ai') {
      const model = params.metadata?.model || 'google/gemini-2.5-flash';
      let inputRate = 0.0000003;
      let outputRate = 0.0000025;
      
      if (model.includes('gemini-2.5-pro')) {
        inputRate = 0.00000125;
        outputRate = 0.00001;
      } else if (model.includes('gemini-2.5-flash-lite')) {
        inputRate = 0.000000075;
        outputRate = 0.0000003;
      }
      
      const inputCost = (params.input_tokens || 0) * inputRate;
      const outputCost = (params.output_tokens || 0) * outputRate;
      cost = inputCost + outputCost;
    }

    await supabase.from('api_costs').insert({
      service_provider: params.service_provider,
      service_type: params.service_type,
      edge_function: params.edge_function,
      booking_id: params.booking_id || null,
      agent_id: params.agent_id || null,
      site_id: params.site_id || null,
      input_tokens: params.input_tokens || null,
      output_tokens: params.output_tokens || null,
      audio_duration_seconds: params.audio_duration_seconds || null,
      character_count: params.character_count || null,
      estimated_cost_usd: cost,
      metadata: params.metadata || {},
      triggered_by_user_id: params.triggered_by_user_id || null,
      is_internal: params.is_internal || false,
    });
    
    console.log(`[Cost] Logged ${params.service_provider} ${params.service_type}: $${cost.toFixed(6)}`);
  } catch (error) {
    // Don't fail the main operation if cost logging fails
    console.error('[Cost] Failed to log API cost:', error);
  }
}

// Select STT provider based on A/B weights
async function selectSTTProvider(supabase: any): Promise<STTProviderName> {
  try {
    const { data: settings, error } = await supabase
      .from('stt_provider_settings')
      .select('provider_name, weight')
      .eq('is_active', true);

    if (error || !settings || settings.length === 0) {
      console.log('[STT A/B] No active provider settings, defaulting to elevenlabs');
      return 'elevenlabs';
    }

    const totalWeight = settings.reduce((sum: number, s: any) => sum + (s.weight || 0), 0);
    if (totalWeight === 0) {
      console.log('[STT A/B] Total weight is 0, defaulting to elevenlabs');
      return 'elevenlabs';
    }

    const random = Math.random() * totalWeight;
    let cumulative = 0;

    for (const setting of settings) {
      cumulative += setting.weight || 0;
      if (random <= cumulative) {
        console.log(`[STT A/B] Selected provider: ${setting.provider_name} (weight: ${setting.weight}/${totalWeight})`);
        return setting.provider_name as STTProviderName;
      }
    }

    return 'elevenlabs';
  } catch (error) {
    console.error('[STT A/B] Error selecting provider:', error);
    return 'elevenlabs';
  }
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
    confidence: undefined, // ElevenLabs doesn't provide overall confidence
    latencyMs,
    wordCount: words.length,
  };
}

// Polish Deepgram transcript with AI for better formatting
async function polishTranscript(
  rawTranscript: string,
  lovableApiKey: string
): Promise<{ polished: string; inputTokens: number; outputTokens: number }> {
  const prompt = `Polish this call transcript for readability. DO NOT change any words or meaning except for the specific corrections below.

CRITICAL BRAND/COMPANY NAME FIXES (always apply these):

=== PadSplit & Internal Tools ===
- "Plates", "plates", "pads", "Pads", "pads split", "pads lit", "pad slit", "pad split", "pad slip", "padspit", "pad's split", "Pet Sitter", "Petsitter", "pet sitter", "past plate", "path to place", "bath split", "bad supplies", "pathway", "pagespeed", "path split", "Radcliffe", "BadgeSplit", "badgesplit" → "PadSplit"
- "Kix", "kicks", "kicky", "kix e", "kix ee" → "Kixie"
- "hub spot", "Hub Spot" → "HubSpot"

=== Competitor Platforms (Housing/Rentals) ===
- "air bnb", "airbee and bee", "air be an be" → "Airbnb"
- "verbo", "ver bo" → "Vrbo"
- "booking dot com", "bookin'", "bookie dot com" → "Booking.com"
- "zillo", "zeal oh" → "Zillow"
- "truly a", "trulee-uh" → "Trulia"
- "realtor dot com", "realter dot com", "real tour" → "Realtor.com"
- "apartments dot com", "apartment dot com" → "Apartments.com"
- "zoomer", "zumperr", "zumba" → "Zumper"
- "hot pads", "hot paths" → "HotPads"
- "rent dot com", "rent calm" → "Rent.com"
- "rent café", "rent-caffee" → "RentCafe"
- "rooster", "room stir" → "Roomster"
- "spare room", "spare-room", "spare rum" → "SpareRoom"
- "roomy", "rumi" → "Roomi"
- "bung a low", "bung below" → "Bungalow"
- "commune", "calm in" → "Common"
- "sawn-der", "sondar" → "Sonder"
- "blue ground", "blue grounds", "blue grown" → "Blueground"

=== Payment Partners ===
- "strip", "strype", "stripey" → "Stripe"
- "pay pal", "papal" → "PayPal"
- "adian", "add yen", "a-d-n" → "Adyen"
- "brain tree", "braintray" → "Braintree"
- "world pay", "word pay" → "Worldpay"
- "check out dot com", "check out calm" → "Checkout.com"
- "played", "plate" → "Plaid"
- "dollar", "dweller", "dwallah" → "Dwolla"

=== Verification Partners (IDV/KYC) ===
- "on fido", "onfiddle", "on-fee-doh" → "Onfido"
- "person uh", "personal" → "Persona"
- "so cure", "soccer", "so-cher" → "Socure"
- "shift" → "Sift"
- "sardines", "sar dean" → "Sardine"
- "truly-o", "trulio", "truly you" → "Trulioo"
- "a loy", "all-oy" → "Alloy"
- "lexus nexus", "lexis", "nexus" → "LexisNexis"
- "joo-me-oh", "junio", "jumeo" → "Jumio"

=== Property/Screening Partners ===
- "yardy", "yar dee" → "Yardi"
- "real page", "rail page" → "RealPage"
- "app folio", "ap polio", "app holy-oh" → "AppFolio"
- "build 'em", "bilidium" → "Buildium"
- "intra-da", "en-trah-ta", "enter ata" → "Entrata"
- "rent ready", "rent reddy" → "RentRedi"
- "rent spree", "rent spray" → "RentSpree"
- "trans union" → "TransUnion"
- "experience", "experion" → "Experian"
- "equi facts", "equal facts" → "Equifax"

FORMATTING FIXES:
1. Capitalization (proper nouns, sentence starts, titles like Mr./Mrs.)
2. Punctuation (commas, periods, question marks)
3. Number formatting ($330 not "three thirty", 10% not "ten percent")
4. Title corrections ("mister" → "Mr.", "missus" → "Mrs.")

KEEP AS-IS:
- All speaker labels (Speaker 0:, Speaker 1:, Agent:, Member:) exactly as-is
- Natural contractions like "gonna", "wanna", "gotta"
- All words not listed in corrections above

RAW TRANSCRIPT:
${rawTranscript}

Return ONLY the polished transcript, no explanation.`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite', // Fast and cheap
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Polish] AI polishing failed:', errorText);
      // Return original on failure
      return { 
        polished: rawTranscript, 
        inputTokens: Math.ceil(prompt.length / 4), 
        outputTokens: 0 
      };
    }

    const result = await response.json();
    const polished = result.choices?.[0]?.message?.content?.trim() || rawTranscript;
    
    const inputTokens = Math.ceil(prompt.length / 4);
    const outputTokens = Math.ceil(polished.length / 4);
    
    console.log(`[Polish] Transcript polished: ${rawTranscript.length} chars → ${polished.length} chars`);
    
    return { polished, inputTokens, outputTokens };
  } catch (error) {
    console.error('[Polish] Error polishing transcript:', error);
    return { 
      polished: rawTranscript, 
      inputTokens: Math.ceil(prompt.length / 4), 
      outputTokens: 0 
    };
  }
}

// Check if AI polishing is enabled in settings
async function isAIPolishEnabled(supabase: any): Promise<boolean> {
  try {
    const { data: settings, error } = await supabase
      .from('stt_provider_settings')
      .select('enable_ai_polish')
      .eq('provider_name', 'deepgram')
      .eq('is_active', true)
      .maybeSingle();

    if (error || !settings) {
      // Default to enabled if no settings found
      return true;
    }

    return settings.enable_ai_polish !== false;
  } catch (error) {
    console.error('[Polish] Error checking AI polish setting:', error);
    return true; // Default to enabled
  }
}

// Transcribe with Deepgram Nova-2 using URL-based API (recommended for large files)
// This eliminates the need to upload audio blobs and prevents SLOW_UPLOAD timeouts
async function transcribeWithDeepgramUrl(
  audioUrl: string,
  apiKey: string
): Promise<STTResult> {
  const startTime = Date.now();
  console.log('[Deepgram] Using URL-based transcription to avoid upload timeouts');

  const response = await fetch(
    'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&diarize=true&language=en-US&punctuate=true',
    {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: audioUrl }),
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

  // Map Deepgram words format to our standard format
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

// Transcribe with Deepgram Nova-2 using blob upload (fallback for non-URL sources)
async function transcribeWithDeepgram(
  audioBlob: Blob,
  apiKey: string
): Promise<STTResult> {
  const startTime = Date.now();
  console.log('[Deepgram] Using blob upload fallback');

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

  // Map Deepgram words format to our standard format
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

// Validate audio URL with HEAD request (lightweight, no download)
async function validateAudioUrl(audioUrl: string): Promise<{ valid: boolean; contentType: string; fileSizeMB: number; error?: string }> {
  console.log('[Validate] Performing HEAD request to validate audio URL...');
  
  try {
    const headResponse = await fetch(audioUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Lovable/1.0)',
      },
    });

    if (!headResponse.ok) {
      const statusText = headResponse.statusText || 'Unknown error';
      let errorMessage = '';
      
      if (headResponse.status === 404) {
        errorMessage = 'Audio file not found (404). The recording may have been deleted or the link is invalid.';
      } else if (headResponse.status === 403) {
        errorMessage = 'Access denied to audio file (403). The recording link may have expired.';
      } else if (headResponse.status === 401) {
        errorMessage = 'Authentication required for audio file (401). The recording link may have expired.';
      } else if (headResponse.status >= 500) {
        errorMessage = `Recording server error (${headResponse.status}). Please try again later.`;
      } else {
        errorMessage = `Failed to access audio: ${headResponse.status} ${statusText}`;
      }
      
      return { valid: false, contentType: '', fileSizeMB: 0, error: errorMessage };
    }

    const contentType = headResponse.headers.get('content-type') || '';
    const contentLength = headResponse.headers.get('content-length');
    const fileSizeMB = contentLength ? parseInt(contentLength, 10) / (1024 * 1024) : 0;

    console.log(`[Validate] Content-Type: ${contentType}, Size: ${fileSizeMB.toFixed(2)} MB`);

    // Check for HTML/webpage responses (invalid audio URL)
    if (contentType.includes('text/html') || contentType.includes('application/json')) {
      return { 
        valid: false, 
        contentType, 
        fileSizeMB,
        error: 'Invalid recording URL - received a webpage instead of audio. Please check the Kixie link. Expected format: https://calls.kixie.com/...wav'
      };
    }

    return { valid: true, contentType, fileSizeMB };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown network error';
    console.error('[Validate] HEAD request failed:', errorMsg);
    return { valid: false, contentType: '', fileSizeMB: 0, error: `Audio validation failed: ${errorMsg}` };
  }
}

// Types for call type configuration
interface CallTypeConfig {
  callType: {
    name: string;
    analysis_focus: string | null;
    scoring_criteria: Record<string, number> | null;
  } | null;
  knowledge: Array<{
    title: string;
    content: string;
    category: string;
  }>;
  rules: Array<{
    rule_name: string;
    rule_type: string;
    rule_description: string | null;
    ai_instruction: string | null;
    weight: number;
  }>;
  script: {
    name: string;
    script_content: string;
  } | null;
}

// Fetch call type configuration from database
async function fetchCallTypeConfig(
  supabase: any,
  callTypeId: string | null
): Promise<CallTypeConfig | null> {
  if (!callTypeId) {
    console.log('[Config] No call_type_id provided, using default prompt');
    return null;
  }

  try {
    // Fetch call type details
    const { data: callType, error: callTypeError } = await supabase
      .from('call_types')
      .select('name, analysis_focus, scoring_criteria')
      .eq('id', callTypeId)
      .eq('is_active', true)
      .maybeSingle();

    if (callTypeError || !callType) {
      console.log('[Config] Call type not found or inactive:', callTypeId);
      return null;
    }

    // Fetch company knowledge for this call type
    const { data: knowledge, error: knowledgeError } = await supabase
      .from('company_knowledge')
      .select('title, content, category')
      .eq('is_active', true)
      .contains('call_type_ids', [callTypeId])
      .order('priority', { ascending: false });

    if (knowledgeError) {
      console.log('[Config] Error fetching knowledge:', knowledgeError);
    }

    // Fetch rules for this call type
    const { data: rules, error: rulesError } = await supabase
      .from('call_type_rules')
      .select('rule_name, rule_type, rule_description, ai_instruction, weight')
      .eq('call_type_id', callTypeId)
      .eq('is_active', true)
      .order('weight', { ascending: false });

    if (rulesError) {
      console.log('[Config] Error fetching rules:', rulesError);
    }

    // Fetch script template for this call type
    const { data: script, error: scriptError } = await supabase
      .from('script_templates')
      .select('name, script_content')
      .eq('call_type_id', callTypeId)
      .eq('is_active', true)
      .maybeSingle();

    if (scriptError) {
      console.log('[Config] Error fetching script:', scriptError);
    }

    console.log(`[Config] Loaded config for call type "${callType.name}":`, {
      hasAnalysisFocus: !!callType.analysis_focus,
      knowledgeCount: knowledge?.length || 0,
      rulesCount: rules?.length || 0,
      hasScript: !!script
    });

    return {
      callType,
      knowledge: knowledge || [],
      rules: rules || [],
      script: script || null
    };
  } catch (error) {
    console.error('[Config] Error fetching call type config:', error);
    return null;
  }
}

// Build dynamic prompt based on configuration
function buildDynamicPrompt(transcription: string, config: CallTypeConfig | null, isNonBooking: boolean = false): string {
  // Default prompt if no config
  if (!config) {
    return buildDefaultPrompt(transcription, isNonBooking);
  }

  const sections: string[] = [];

  // Header with call type context
  sections.push(`You are an expert at analyzing sales call transcriptions for PadSplit, a housing/rental service.
This is a "${config.callType?.name || 'General'}" call type.`);

  // Analysis focus from call type
  if (config.callType?.analysis_focus) {
    sections.push(`
ANALYSIS FOCUS:
${config.callType.analysis_focus}`);
  }

  // Company knowledge context
  if (config.knowledge.length > 0) {
    sections.push(`
COMPANY KNOWLEDGE (use this context when analyzing):
${config.knowledge.map(k => `
[${k.category.toUpperCase()}] ${k.title}:
${k.content}`).join('\n')}`);
  }

  // Evaluation rules grouped by type
  const requiredRules = config.rules.filter(r => r.rule_type === 'required');
  const recommendedRules = config.rules.filter(r => r.rule_type === 'recommended');
  const prohibitedRules = config.rules.filter(r => r.rule_type === 'prohibited');

  if (requiredRules.length > 0 || recommendedRules.length > 0 || prohibitedRules.length > 0) {
    sections.push(`
EVALUATION CRITERIA:`);

    if (requiredRules.length > 0) {
      sections.push(`
REQUIRED (agent MUST do these - mark as improvement if missing):
${requiredRules.map(r => `- ${r.rule_name}: ${r.ai_instruction || r.rule_description || ''}`).join('\n')}`);
    }

    if (recommendedRules.length > 0) {
      sections.push(`
RECOMMENDED (positive if done, note if missing):
${recommendedRules.map(r => `- ${r.rule_name}: ${r.ai_instruction || r.rule_description || ''}`).join('\n')}`);
    }

    if (prohibitedRules.length > 0) {
      sections.push(`
PROHIBITED (flag as issue if detected):
${prohibitedRules.map(r => `- ${r.rule_name}: ${r.ai_instruction || r.rule_description || ''}`).join('\n')}`);
    }
  }

  // Script adherence if script exists
  if (config.script) {
    sections.push(`
SCRIPT TEMPLATE (evaluate adherence):
Script: "${config.script.name}"
${config.script.script_content}

Note: Agent should follow the general structure and key talking points. Minor deviations are acceptable if the conversation flows naturally.`);
  }

  // Core instructions
  sections.push(`
CRITICAL INSTRUCTIONS:
1. Extract ALL relevant information, even minor mentions
2. If the call is short or limited, still extract what you can
3. NEVER return empty arrays if there's ANY relevant content
4. For short calls (under 2 minutes), adapt your analysis to the available content
5. Be specific - quote or paraphrase actual phrases from the call when possible
6. Evaluate against the EVALUATION CRITERIA above when generating feedback

TRANSCRIPTION:
${transcription}`);

  // Output format with custom scoring if defined
  const scoringGuide = config.callType?.scoring_criteria 
    ? `CUSTOM SCORING WEIGHTS:
${Object.entries(config.callType.scoring_criteria).map(([key, weight]) => `- ${key}: weight ${weight}`).join('\n')}`
    : `SCORING GUIDE (1-10):
- 9-10: Exceptional, textbook execution
- 7-8: Good, minor improvements possible  
- 5-6: Average, noticeable gaps
- 3-4: Below average, significant issues
- 1-2: Poor, major problems`;

  sections.push(`
Return a JSON object with EXACTLY this structure (no markdown, just raw JSON):
{
  "summary": "A concise 2-3 sentence summary capturing the key points of this call. What was discussed? What was the outcome?",
  "memberDetails": {
    "firstName": "string or null - the member's first name if mentioned",
    "lastName": "string or null - the member's last name if mentioned",
    "phoneNumber": "string or null - phone number if mentioned or confirmed (format: xxx-xxx-xxxx)",
    "email": "string or null - email address if mentioned",
    "householdSize": "number or null - how many people will be moving in",
    "weeklyBudget": "number or null - their weekly budget amount in dollars",
    "moveInDate": "string or null - specific move-in date mentioned (e.g., 'December 15' or 'next Monday')",
    "commitmentWeeks": "number or null - how many weeks they plan to stay",
    "preferredPaymentMethod": "string or null - cash, card, etc.",
    "propertyAddress": "string or null - specific property address or listing being discussed",
    "marketCity": "string or null - the city name where the property is located (e.g., 'Atlanta', 'Houston', 'Tampa', 'Dallas')",
    "marketState": "string or null - the US state abbreviation where the property is located (e.g., 'GA', 'TX', 'FL', 'NC')"
  },
  "memberConcerns": ["List every concern, worry, hesitation, or question raised by the member"],
  "memberPreferences": ["List ALL preferences mentioned: location, budget, timing, room type, amenities, etc."],
  "recommendedActions": ["Specific follow-up actions for the agent"],
  "objections": ["Any hesitations, pushback, or reasons the member gave for not committing"],
  "moveInReadiness": "high | medium | low",
  "callSentiment": "positive | neutral | negative"${isNonBooking ? `,
  "buyerIntent": {
    "score": 65,
    "intentLevel": "hot (75-100: high conversion potential) | warm (40-74: interested but needs nurturing) | cold (0-39: low immediate potential)",
    "positiveSignals": ["List signals indicating buying intent: specific move-in date, budget confirmed, asked about booking process, decision maker, detailed questions"],
    "negativeSignals": ["List signals reducing intent: 'just looking', price objections, needs to ask others, comparison shopping, no timeline"],
    "decisionMaker": true,
    "timeframe": "immediate (moving ASAP) | this_week | this_month | exploring (just researching)"
  }` : ''},
  "agentFeedback": {
    "overallRating": "excellent | good | needs_improvement | poor",
    "strengths": ["Specific things the agent did well, especially related to the evaluation criteria"],
    "improvements": ["Areas to improve, especially missed required criteria or prohibited behaviors"],
    "coachingTips": ["Actionable tips based on the evaluation criteria"],
    "scores": {
      "communication": 7,
      "productKnowledge": 7,
      "objectionHandling": 7,
      "closingSkills": 7
    }
  },
  "lifestyleSignals": [
    {
      "category": "healthcare | pet | transportation | home_services | telephony | employment | financial | moving",
      "signal": "Exact quote or paraphrase from the conversation indicating a lifestyle need or opportunity",
      "confidence": "high (explicitly stated) | medium (strongly implied) | low (loosely inferred)",
      "opportunity": "Brief description of the cross-sell/upsell opportunity (e.g., 'ACA enrollment partnership', 'Pet insurance referral')"
    }
  ],
  "pricingDiscussed": {
    "mentioned": true,
    "details": "Brief description of what pricing was discussed (e.g., 'Agent quoted $185/week and explained deposit structure', 'Weekly rate of $200 mentioned'). If not discussed, say 'No pricing information was shared during the call'",
    "agentInitiated": true
  }
}

PRICING DISCUSSION DETECTION:
- "mentioned": true if the agent discussed ANY pricing details (weekly rates, deposits, move-in costs, promo codes, payment amounts)
- "mentioned": false if no pricing was shared during the call
- "details": Summarize what was specifically covered (amounts quoted, fee structures explained, promo codes mentioned)
- "agentInitiated": true if the agent proactively brought up pricing; false if only in response to the member asking

LIFESTYLE SIGNALS EXTRACTION GUIDE:
- healthcare: mentions of no insurance, needing coverage, ACA/Obamacare, medical needs, uninsured
- pet: mentions of dogs, cats, pets, pet-friendly, pet deposits, animal needs
- transportation: car details, no car, rideshare (Uber/Lyft), bus, transit needs
- home_services: furniture needs, cleaning, WiFi/internet, laundry, appliances, bedding
- telephony: phone plan issues, no phone service, prepaid phone, WiFi calling needs
- employment: job searching, work schedule, unemployment, gig work, "not working"
- financial: payment difficulties, no bank account, credit issues, cash-only, payday loans
- moving: moving help, storage needs, shipping belongings, U-Haul, packing
Only include signals with genuine evidence from the conversation. Return an empty array if no lifestyle signals are detected.

${scoringGuide}${isNonBooking ? `

BUYER INTENT SCORING GUIDE (0-100):
Calculate the buyerIntent.score by adding/subtracting these weights:
+20: Specific move-in date within 7 days
+15: Budget confirmed and within PadSplit range ($150-$250/week)
+15: Asked about booking/move-in process or deposits
+10: Single decision maker confirmed
+10: First-time caller with specific property interest
+5:  Positive call sentiment
+5:  Asked follow-up questions
-10: "Just looking" or "researching for someone else"
-15: Price objections unresolved at call end
-15: Decision maker absent ("need to ask my wife/husband")
-10: Comparison shopping explicitly mentioned
-10: No specific timeline mentioned
-5:  Negative call sentiment

Start at 50 as baseline. Final score should be 0-100.
intentLevel: "hot" (75-100), "warm" (40-74), "cold" (0-39)` : ''}

IMPORTANT: Even for very short calls, provide meaningful analysis. Reference the evaluation criteria in your feedback.`);

  return sections.join('\n');
}

// Default prompt for calls without call type configuration
function buildDefaultPrompt(transcription: string, isNonBooking: boolean = false): string {
  return `You are an expert at analyzing sales call transcriptions for PadSplit, a housing/rental service.

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
  "memberDetails": {
    "firstName": "string or null - the member's first name if mentioned",
    "lastName": "string or null - the member's last name if mentioned",
    "phoneNumber": "string or null - phone number if mentioned or confirmed (format: xxx-xxx-xxxx)",
    "email": "string or null - email address if mentioned",
    "householdSize": "number or null - how many people will be moving in",
    "weeklyBudget": "number or null - their weekly budget amount in dollars",
    "moveInDate": "string or null - specific move-in date mentioned (e.g., 'December 15' or 'next Monday')",
    "commitmentWeeks": "number or null - how many weeks they plan to stay",
    "preferredPaymentMethod": "string or null - cash, card, etc.",
    "propertyAddress": "string or null - specific property address or listing being discussed",
    "marketCity": "string or null - the city name where the property is located (e.g., 'Atlanta', 'Houston', 'Tampa', 'Dallas')",
    "marketState": "string or null - the US state abbreviation where the property is located (e.g., 'GA', 'TX', 'FL', 'NC')"
  },
  "memberConcerns": ["List every concern, worry, hesitation, or question raised by the member, even minor ones. Example: 'Worried about parking availability', 'Concerned about noise levels'"],
  "memberPreferences": ["List ALL preferences mentioned: location, budget, timing, room type, amenities, etc. Example: 'Prefers ground floor', 'Budget under $800', 'Needs to move by next week'"],
  "recommendedActions": ["Specific follow-up actions for the agent. Example: 'Send listing links for downtown properties', 'Follow up about move-in date confirmation', 'Schedule property tour'"],
  "objections": ["Any hesitations, pushback, or reasons the member gave for not committing. Example: 'Wants to see other options first', 'Price is higher than expected'"],
  "moveInReadiness": "high (ready to move within days, very motivated) | medium (interested but exploring options, flexible timeline) | low (just researching, no urgency)",
  "callSentiment": "positive (member engaged, interested, good rapport) | neutral (standard business conversation) | negative (frustrated, disengaged, complaints)"${isNonBooking ? `,
  "buyerIntent": {
    "score": 65,
    "intentLevel": "hot (75-100: high conversion potential) | warm (40-74: interested but needs nurturing) | cold (0-39: low immediate potential)",
    "positiveSignals": ["List signals indicating buying intent: specific move-in date, budget confirmed, asked about booking process, decision maker, detailed questions about properties"],
    "negativeSignals": ["List signals reducing intent: 'just looking', unresolved price objections, needs to ask spouse/others, comparison shopping, no specific timeline"],
    "decisionMaker": true,
    "timeframe": "immediate (moving ASAP/within days) | this_week | this_month | exploring (just researching)"
  }` : ''},
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
  },
  "lifestyleSignals": [
    {
      "category": "healthcare | pet | transportation | home_services | telephony | employment | financial | moving",
      "signal": "Exact quote or paraphrase from the conversation indicating a lifestyle need or opportunity",
      "confidence": "high (explicitly stated) | medium (strongly implied) | low (loosely inferred)",
      "opportunity": "Brief description of the cross-sell/upsell opportunity (e.g., 'ACA enrollment partnership', 'Pet insurance referral')"
    }
  ],
  "pricingDiscussed": {
    "mentioned": true,
    "details": "Brief description of what pricing was discussed (e.g., 'Agent quoted $185/week and explained deposit structure', 'Weekly rate of $200 mentioned'). If not discussed, say 'No pricing information was shared during the call'",
    "agentInitiated": true
  }
}

PRICING DISCUSSION DETECTION:
- "mentioned": true if the agent discussed ANY pricing details (weekly rates, deposits, move-in costs, promo codes, payment amounts)
- "mentioned": false if no pricing was shared during the call
- "details": Summarize what was specifically covered (amounts quoted, fee structures explained, promo codes mentioned)
- "agentInitiated": true if the agent proactively brought up pricing; false if only in response to the member asking

LIFESTYLE SIGNALS EXTRACTION GUIDE:
- healthcare: mentions of no insurance, needing coverage, ACA/Obamacare, medical needs, uninsured
- pet: mentions of dogs, cats, pets, pet-friendly, pet deposits, animal needs
- transportation: car details, no car, rideshare (Uber/Lyft), bus, transit needs
- home_services: furniture needs, cleaning, WiFi/internet, laundry, appliances, bedding
- telephony: phone plan issues, no phone service, prepaid phone, WiFi calling needs
- employment: job searching, work schedule, unemployment, gig work, "not working"
- financial: payment difficulties, no bank account, credit issues, cash-only, payday loans
- moving: moving help, storage needs, shipping belongings, U-Haul, packing
Only include signals with genuine evidence from the conversation. Return an empty array if no lifestyle signals are detected.

SCORING GUIDE (1-10):
- 9-10: Exceptional, textbook execution
- 7-8: Good, minor improvements possible  
- 5-6: Average, noticeable gaps
- 3-4: Below average, significant issues
- 1-2: Poor, major problems${isNonBooking ? `

BUYER INTENT SCORING GUIDE (0-100):
Calculate the buyerIntent.score by adding/subtracting these weights:
+20: Specific move-in date within 7 days
+15: Budget confirmed and within PadSplit range ($150-$250/week)
+15: Asked about booking/move-in process or deposits
+10: Single decision maker confirmed
+10: First-time caller with specific property interest
+5:  Positive call sentiment
+5:  Asked follow-up questions
-10: "Just looking" or "researching for someone else"
-15: Price objections unresolved at call end
-15: Decision maker absent ("need to ask my wife/husband")
-10: Comparison shopping explicitly mentioned
-10: No specific timeline mentioned
-5:  Negative call sentiment

Start at 50 as baseline. Final score should be 0-100.
intentLevel: "hot" (75-100), "warm" (40-74), "cold" (0-39)` : ''}

IMPORTANT: Even for very short calls, provide meaningful analysis. A 1-minute call checking availability still has extractable insights (member's location interest, timing, urgency level).`;
}

// AI-based speaker identification to correctly label Agent vs Member
async function identifySpeakers(
  rawTranscript: string,
  lovableApiKey: string
): Promise<{ speaker_0: string; speaker_1: string; confidence: string }> {
  console.log('[Speaker ID] Starting AI-based speaker identification...');
  
  const prompt = `Analyze this call transcript between a PadSplit sales agent and a prospective member.

CONTEXT: PadSplit is a housing/room rental service. The Agent works for PadSplit and helps people find rooms. The Member is looking for housing.

AGENT INDICATORS (person who works for PadSplit):
- Introduces themselves with name/company ("Hi, this is X from PadSplit", "Thank you for calling PadSplit")
- Asks qualifying questions (budget, move-in date, household size, employment)
- Offers to help, look up listings, send information
- Uses professional language and call handling phrases ("How can I help you today?")
- Provides information about PadSplit services/process/policies
- Confirms availability, pricing, or property details
- Guides the conversation structure

MEMBER INDICATORS (person looking for housing):
- Looking for housing/rooms/apartments ("I'm looking for a place", "I need a room")
- Asks about prices, availability, locations, amenities
- Shares personal details when asked (budget, timeline, family size, job)
- May express concerns or objections about moving
- Generally responds to questions rather than leading the conversation
- Discusses their current living situation or reasons for moving

TRANSCRIPT (first portion):
${rawTranscript.substring(0, 3000)}

Based on the conversation patterns above, identify which speaker is the Agent (PadSplit employee).

CRITICAL: Look at WHO is asking qualifying questions vs WHO is answering them. The Agent ASKS, the Member ANSWERS.

Return ONLY a JSON object (no markdown, no explanation):
{
  "speaker_0": "Agent" or "Member",
  "speaker_1": "Agent" or "Member",
  "confidence": "high" or "medium" or "low",
  "reason": "Brief explanation"
}`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite', // Fast, cheap model for this task
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      console.error('[Speaker ID] AI request failed:', response.status);
      return { speaker_0: 'Agent', speaker_1: 'Member', confidence: 'fallback' };
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';
    
    // Parse the JSON response
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```json')) cleanedContent = cleanedContent.slice(7);
    if (cleanedContent.startsWith('```')) cleanedContent = cleanedContent.slice(3);
    if (cleanedContent.endsWith('```')) cleanedContent = cleanedContent.slice(0, -3);
    cleanedContent = cleanedContent.trim();
    
    const parsed = JSON.parse(cleanedContent);
    
    // Validate the response
    if (parsed.speaker_0 && parsed.speaker_1) {
      console.log(`[Speaker ID] Identified: speaker_0=${parsed.speaker_0}, speaker_1=${parsed.speaker_1}, confidence=${parsed.confidence}`);
      console.log(`[Speaker ID] Reason: ${parsed.reason || 'not provided'}`);
      return {
        speaker_0: parsed.speaker_0,
        speaker_1: parsed.speaker_1,
        confidence: parsed.confidence || 'medium'
      };
    }
    
    throw new Error('Invalid speaker identification response');
  } catch (error) {
    console.error('[Speaker ID] Error identifying speakers:', error);
    // Fallback to original assumption
    return { speaker_0: 'Agent', speaker_1: 'Member', confidence: 'fallback' };
  }
}

// Format raw transcript with generic labels for speaker identification
function formatRawTranscript(words: any[]): string {
  const segments: string[] = [];
  let currentSpeaker = '';
  let currentText = '';
  
  for (const word of words) {
    const speaker = word.speaker_id || 'Unknown';
    
    if (speaker !== currentSpeaker) {
      if (currentText.trim()) {
        segments.push(`${currentSpeaker}: ${currentText.trim()}`);
      }
      currentSpeaker = speaker;
      currentText = word.text + ' ';
    } else {
      currentText += word.text + ' ';
    }
  }
  
  if (currentText.trim()) {
    segments.push(`${currentSpeaker}: ${currentText.trim()}`);
  }
  
  return segments.join('\n\n');
}

// Apply correct speaker labels based on AI identification
function applyCorrectLabels(
  words: any[],
  speakerMapping: { speaker_0: string; speaker_1: string }
): string {
  const segments: string[] = [];
  let currentSpeaker = '';
  let currentText = '';
  
  for (const word of words) {
    const rawSpeaker = word.speaker_id || 'Unknown';
    
    if (rawSpeaker !== currentSpeaker) {
      if (currentText.trim()) {
        // Map speaker_0/speaker_1 to Agent/Member based on AI identification
        let label = currentSpeaker;
        if (currentSpeaker === 'speaker_0') {
          label = speakerMapping.speaker_0;
        } else if (currentSpeaker === 'speaker_1') {
          label = speakerMapping.speaker_1;
        }
        segments.push(`${label}: ${currentText.trim()}`);
      }
      currentSpeaker = rawSpeaker;
      currentText = word.text + ' ';
    } else {
      currentText += word.text + ' ';
    }
  }
  
  if (currentText.trim()) {
    let label = currentSpeaker;
    if (currentSpeaker === 'speaker_0') {
      label = speakerMapping.speaker_0;
    } else if (currentSpeaker === 'speaker_1') {
      label = speakerMapping.speaker_1;
    }
    segments.push(`${label}: ${currentText.trim()}`);
  }
  
  return segments.join('\n\n');
}

// Helper to update booking with error message
async function updateBookingError(supabase: any, bookingId: string, errorMessage: string) {
  try {
    const { error } = await supabase
      .from('bookings')
      .update({ 
        transcription_status: 'failed',
        transcription_error_message: errorMessage 
      })
      .eq('id', bookingId);
    if (error && error.code === '42703') {
      console.warn(`[Background] Schema cache stale (42703) on error update for ${bookingId}. Status update skipped.`);
    } else if (error) {
      console.error('[Background] Failed to update error status:', error);
    }
  } catch (e) {
    console.error('[Background] Failed to update error status:', e);
  }
}

// Background transcription processing with timeout handling
async function processTranscription(bookingId: string, kixieUrl: string, skipTts: boolean = false) {
  console.log(`[Background] Starting transcription for booking ${bookingId} (skipTts: ${skipTts})`);
  
  const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
  const deepgramApiKey = Deno.env.get('DEEPGRAM_API_KEY');
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  const supabase = createClient(supabaseUrl!, supabaseServiceKey!);
  
  // Set a timeout to mark as failed if processing takes too long (5 minutes)
  const TIMEOUT_MS = 5 * 60 * 1000;
  const timeoutId = setTimeout(async () => {
    console.error(`[Background] Transcription timeout for booking ${bookingId} after 5 minutes`);
    await updateBookingError(supabase, bookingId, 'Processing timeout - the audio file may be too large or the service is busy. Please try again.');
  }, TIMEOUT_MS);

  // Variables to track for cost logging
  let agentId: string | null = null;
  let siteId: string | null = null;

  try {
    // Deduplication guard: atomically claim processing status
    // Only proceed if status is 'queued' or NULL (belt-and-suspenders with check-auto-transcription)
    const { data: claimResult, error: claimError } = await supabase
      .from('bookings')
      .update({ 
        transcription_status: 'processing',
        transcription_error_message: null 
      })
      .eq('id', bookingId)
      .or('transcription_status.is.null,transcription_status.eq.queued,transcription_status.eq.failed')
      .select('id')
      .maybeSingle();

    let claimBypassed = false;
    if (claimError) {
      if (claimError.code === '42703') {
        claimBypassed = true;
        console.warn(`[Background] Schema cache stale (42703) for ${bookingId}. Bypassing claim and proceeding.`);
      } else {
        console.error(`[Background] Claim error for ${bookingId}:`, claimError);
        clearTimeout(timeoutId);
        return;
      }
    }

    if (!claimResult && !claimBypassed) {
      console.log(`[Background] Booking ${bookingId} already processing/completed, skipping duplicate`);
      clearTimeout(timeoutId);
      return;
    }

    // Fetch booking to get call_type_id, agent_id, site_id, and status
    const { data: bookingData, error: bookingError } = await supabase
      .from('bookings')
      .select('call_type_id, agent_id, status, agents(site_id)')
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingError) {
      console.log('[Background] Error fetching booking:', bookingError);
    }

    const callTypeId = bookingData?.call_type_id || null;
    agentId = bookingData?.agent_id || null;
    siteId = (bookingData?.agents as any)?.site_id || null;
    const bookingStatus = bookingData?.status || null;
    const isNonBooking = bookingStatus === 'Non Booking';
    console.log(`[Background] Booking call_type_id: ${callTypeId || 'none'}, agent_id: ${agentId}, site_id: ${siteId}, status: ${bookingStatus}`);

    // Fetch call type configuration if available
    const config = await fetchCallTypeConfig(supabase, callTypeId);

    // Step 1: Validate the audio URL using lightweight HEAD request
    console.log('[Background] Validating audio URL...');
    console.log('[Background] Audio URL:', kixieUrl.substring(0, 80) + '...');
    
    const validation = await validateAudioUrl(kixieUrl);
    if (!validation.valid) {
      console.error('[Background] Audio URL validation failed:', validation.error);
      clearTimeout(timeoutId);
      await updateBookingError(supabase, bookingId, validation.error || 'Audio validation failed');
      return;
    }
    
    const fileSizeMB = validation.fileSizeMB;
    console.log(`[Background] Audio validated, estimated size: ${fileSizeMB.toFixed(2)} MB`);

    // Step 2: Select STT provider and transcribe using A/B testing
    const selectedProvider = await selectSTTProvider(supabase);
    console.log(`[Background] Using STT provider: ${selectedProvider}`);
    
    let sttResult: STTResult;
    let transcription = '';
    let callDurationSeconds: number | null = null;

    try {
      if (selectedProvider === 'deepgram' && deepgramApiKey) {
        // Use URL-based transcription for Deepgram - eliminates SLOW_UPLOAD timeouts
        // Deepgram fetches the audio directly from Kixie CDN
        console.log('[Background] Sending URL to Deepgram Nova-2 (URL-based, no upload)...');
        sttResult = await transcribeWithDeepgramUrl(kixieUrl, deepgramApiKey);
      } else {
        // ElevenLabs requires blob upload, so download the audio first
        console.log('[Background] Downloading audio for ElevenLabs...');
        const audioResponse = await fetch(kixieUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Lovable/1.0)',
          },
        });
        
        if (!audioResponse.ok) {
          throw new Error(`Audio download failed: ${audioResponse.status}`);
        }
        
        const audioBlob = await audioResponse.blob();
        
        // Validate blob content
        if (audioBlob.size < 1000) {
          throw new Error('Audio file is empty or corrupted');
        }
        
        const firstBytes = await audioBlob.slice(0, 100).text();
        if (firstBytes.includes('<!DOCTYPE') || firstBytes.includes('<html')) {
          throw new Error('URL points to a webpage, not an audio file');
        }
        
        console.log('[Background] Sending to ElevenLabs Speech-to-Text...');
        sttResult = await transcribeWithElevenLabs(audioBlob, elevenLabsApiKey!);
      }
    } catch (sttError) {
      const errorMessage = sttError instanceof Error ? sttError.message : 'STT transcription failed';
      console.error(`[Background] ${selectedProvider} STT error:`, errorMessage);
      
      // Check for billing/quota issues with ElevenLabs
      if (selectedProvider === 'elevenlabs' && (
        errorMessage.includes('payment') || 
        errorMessage.includes('402') ||
        errorMessage.includes('quota')
      )) {
        // Create admin notification for billing issues
        const { data: existing } = await supabase
          .from('admin_notifications')
          .select('id')
          .eq('notification_type', 'billing_alert')
          .eq('service', 'elevenlabs')
          .eq('is_resolved', false)
          .limit(1);

        if (!existing || existing.length === 0) {
          await supabase.from('admin_notifications').insert({
            notification_type: 'billing_alert',
            service: 'elevenlabs',
            title: 'ElevenLabs API Issue',
            message: `Transcription failed: ${errorMessage}`,
            severity: 'critical',
            metadata: { booking_id: bookingId, error: errorMessage.substring(0, 500) }
          });
        }
      }
      
      clearTimeout(timeoutId);
      await updateBookingError(supabase, bookingId, `${selectedProvider} transcription failed: ${errorMessage}`);
      return;
    }

    transcription = sttResult.transcription;
    callDurationSeconds = sttResult.durationSeconds;
    const sttLatencyMs = sttResult.latencyMs;
    const sttWordCount = sttResult.wordCount;
    const sttConfidenceScore = sttResult.confidence;

    console.log(`[Background] ${selectedProvider} transcription complete:`, {
      length: transcription.length,
      duration: callDurationSeconds,
      latency: sttLatencyMs,
      wordCount: sttWordCount,
      confidence: sttConfidenceScore
    });

    // Step 1: Apply speaker identification FIRST (for all providers)
    // This must happen before polishing since applyCorrectLabels rebuilds from raw words
    if (sttResult.words && sttResult.words.length > 0) {
      const mins = Math.floor(callDurationSeconds / 60);
      const secs = callDurationSeconds % 60;
      console.log(`[Background] Call duration: ${callDurationSeconds} seconds (${mins}:${secs.toString().padStart(2, '0')})`);

      // Phase 1: Format raw transcript with generic speaker labels
      const rawTranscript = formatRawTranscript(sttResult.words);
      
      // Phase 2: Use AI to identify which speaker is Agent vs Member
      const speakerMapping = await identifySpeakers(rawTranscript, lovableApiKey!);
      
      // Log cost for speaker identification (small AI call)
      const speakerIdInputTokens = Math.ceil(3000 / 4); // ~3000 chars prompt
      const speakerIdOutputTokens = Math.ceil(150 / 4); // ~150 chars response
      logApiCost(supabase, {
        service_provider: 'lovable_ai',
        service_type: 'speaker_identification',
        edge_function: 'transcribe-call',
        booking_id: bookingId,
        agent_id: agentId || undefined,
        site_id: siteId || undefined,
        input_tokens: speakerIdInputTokens,
        output_tokens: speakerIdOutputTokens,
        metadata: { 
          model: 'google/gemini-2.5-flash-lite', 
          confidence: speakerMapping.confidence,
          speaker_0: speakerMapping.speaker_0,
          speaker_1: speakerMapping.speaker_1
        }
      });
      
      // Phase 3: Apply correct labels based on AI identification
      transcription = applyCorrectLabels(sttResult.words, speakerMapping);
      
      if (speakerMapping.confidence === 'fallback') {
        console.log('[Background] Warning: Speaker identification failed, using fallback assumption');
      }
    }

    // Step 2: Apply AI polishing AFTER speaker identification (for Deepgram only)
    // This ensures brand corrections are applied to the FINAL transcript
    let polishApplied = false;
    if (selectedProvider === 'deepgram') {
      const polishEnabled = await isAIPolishEnabled(supabase);
      if (polishEnabled && transcription.length > 0) {
        console.log('[Background] Polishing Deepgram transcript with AI...');
        const originalLength = transcription.length;
        const polishResult = await polishTranscript(transcription, lovableApiKey!);
        
        if (polishResult.polished !== transcription) {
          transcription = polishResult.polished;
          polishApplied = true;
          
          // Log the polishing cost
          logApiCost(supabase, {
            service_provider: 'lovable_ai',
            service_type: 'transcript_polishing',
            edge_function: 'transcribe-call',
            booking_id: bookingId,
            agent_id: agentId || undefined,
            site_id: siteId || undefined,
            input_tokens: polishResult.inputTokens,
            output_tokens: polishResult.outputTokens,
            metadata: { 
              model: 'google/gemini-2.5-flash-lite',
              original_length: originalLength,
              polished_length: polishResult.polished.length
            }
          });
          
          console.log(`[Background] Transcript polished successfully`);
        }
      } else {
        console.log('[Background] AI polishing disabled or empty transcript, skipping');
      }
    }
    
    console.log(`[Background] ${selectedProvider} transcription formatted, length:`, transcription.length);

    // Log STT cost for the selected provider
    if (callDurationSeconds) {
      logApiCost(supabase, {
        service_provider: selectedProvider,
        service_type: 'stt_transcription',
        edge_function: 'transcribe-call',
        booking_id: bookingId,
        agent_id: agentId || undefined,
        site_id: siteId || undefined,
        audio_duration_seconds: callDurationSeconds,
        metadata: { 
          model: selectedProvider === 'deepgram' ? 'nova-2' : 'scribe_v1', 
          file_size_mb: fileSizeMB,
          latency_ms: sttLatencyMs,
          word_count: sttWordCount,
          confidence: sttConfidenceScore
        }
      });
    }
    // Step 3: Generate summary, key points, and agent feedback with dynamic prompt
    console.log('[Background] Generating AI summary and agent feedback...');
    const summaryPrompt = buildDynamicPrompt(transcription, config, isNonBooking);
    
    // Hybrid LLM selection: choose provider based on weights and fallback conditions
    const llmSelection = await selectLLMProvider(supabase, bookingStatus, callDurationSeconds);
    console.log(`[Background] Using LLM provider: ${llmSelection.provider} (model: ${llmSelection.model}${llmSelection.fallbackReason ? `, fallback: ${llmSelection.fallbackReason}` : ''})`);

    let aiContent = '';
    let estimatedInputTokens = 0;
    let estimatedOutputTokens = 0;

    if (llmSelection.provider === 'deepseek') {
      // Use DeepSeek for analysis with provider-specific prompt enhancements
      let systemPrompt = 'You are an expert at analyzing sales call transcriptions. Always respond with valid JSON only, no markdown.';
      
      // Fetch and inject provider-specific enhancements for improved readiness detection
      const enhancements = await getProviderPromptEnhancements(supabase, 'deepseek');
      if (enhancements) {
        systemPrompt = enhancements + '\n\n' + systemPrompt;
        console.log('[Background] DeepSeek prompt enhanced with few-shot examples and scoring rules');
      }
      
      const deepseekResult = await callDeepSeekForAnalysis(systemPrompt, summaryPrompt);
      aiContent = deepseekResult.content;
      estimatedInputTokens = deepseekResult.inputTokens;
      estimatedOutputTokens = deepseekResult.outputTokens;

      // Log DeepSeek cost
      logApiCost(supabase, {
        service_provider: 'deepseek',
        service_type: 'ai_analysis',
        edge_function: 'transcribe-call',
        booking_id: bookingId,
        agent_id: agentId || undefined,
        site_id: siteId || undefined,
        input_tokens: estimatedInputTokens,
        output_tokens: estimatedOutputTokens,
        metadata: { 
          model: deepseekResult.model, 
          transcription_length: transcription.length, 
          call_duration_seconds: callDurationSeconds,
          latency_ms: deepseekResult.latencyMs,
          fallback_reason: llmSelection.fallbackReason,
          prompt_enhanced: !!enhancements
        }
      });
    } else {
      // Use Gemini (Lovable AI) for analysis
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: llmSelection.model,
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
      aiContent = aiResult.choices?.[0]?.message?.content || '';
      estimatedInputTokens = Math.ceil(summaryPrompt.length / 4);
      estimatedOutputTokens = Math.ceil(aiContent.length / 4);

      // Log Lovable AI cost
      logApiCost(supabase, {
        service_provider: 'lovable_ai',
        service_type: 'ai_analysis',
        edge_function: 'transcribe-call',
        booking_id: bookingId,
        agent_id: agentId || undefined,
        site_id: siteId || undefined,
        input_tokens: estimatedInputTokens,
        output_tokens: estimatedOutputTokens,
        metadata: { 
          model: llmSelection.model, 
          transcription_length: transcription.length, 
          call_duration_seconds: callDurationSeconds,
          fallback_reason: llmSelection.fallbackReason
        }
      });
    }

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
        callSentiment: parsed.callSentiment || 'neutral',
        memberDetails: parsed.memberDetails || null,
        // Only include buyerIntent for Non-Booking calls
        ...(isNonBooking && parsed.buyerIntent ? { buyerIntent: parsed.buyerIntent } : {}),
        // Lifestyle signals for cross-sell opportunities
        ...(parsed.lifestyleSignals && parsed.lifestyleSignals.length > 0 ? { lifestyleSignals: parsed.lifestyleSignals } : {})
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

    // ===== CONVERSATION VALIDITY CHECK =====
    // Detect voicemails, failed connections, and calls without real conversations
    const hasValidConversation = validateConversation({
      durationSeconds: callDurationSeconds,
      transcription: transcription,
      summary: summary,
    });
    
    if (!hasValidConversation) {
      console.log(`[Background] ⚠️ No valid conversation detected for ${bookingId} - likely voicemail/failed connection`);
    }

    // Step 4: Update the booking status and insert transcription data to separate table
    console.log('[Background] Updating booking status and inserting transcription data...');
    
    // First update the booking status (light data stays in bookings table)
    // ===== PAIN POINT ISSUE CLASSIFICATION =====
    const detectedIssues = classifyIssuesFromKeyPoints(keyPoints);
    if (detectedIssues.length > 0) {
      console.log(`[Background] Detected issues for ${bookingId}: ${detectedIssues.join(', ')}`);
    }

    const { error: bookingUpdateError } = await supabase
      .from('bookings')
      .update({
        transcription_status: 'completed',
        transcribed_at: new Date().toISOString(),
        call_duration_seconds: callDurationSeconds,
        has_valid_conversation: hasValidConversation,
        detected_issues: detectedIssues.length > 0 ? detectedIssues : [],
      })
      .eq('id', bookingId);

    if (bookingUpdateError) {
      if (bookingUpdateError.code === '42703') {
        console.warn(`[Background] Schema cache stale (42703) on completion update for ${bookingId}. Skipping status update, saving transcription data.`);
      } else {
        console.error('[Background] Booking update error:', bookingUpdateError);
        throw new Error(`Failed to update booking: ${bookingUpdateError.message}`);
      }
    }

    // Then upsert the heavy data to booking_transcriptions table with A/B testing metrics
    const { error: transcriptionError } = await supabase
      .from('booking_transcriptions')
      .upsert({
        booking_id: bookingId,
        call_transcription: transcription,
        call_summary: summary,
        call_key_points: keyPoints,
        agent_feedback: agentFeedback,
        stt_provider: selectedProvider,
        stt_latency_ms: sttLatencyMs,
        stt_word_count: sttWordCount,
        stt_confidence_score: sttConfidenceScore,
        llm_provider: llmSelection.provider,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'booking_id'
      });

    if (transcriptionError) {
      console.error('[Background] Transcription insert error:', transcriptionError);
      throw new Error(`Failed to save transcription: ${transcriptionError.message}`);
    }

    // ===== AUTO-ENRICH MARKET DATA FROM TRANSCRIPTION =====
    const memberDetails = keyPoints?.memberDetails;
    if (memberDetails?.marketCity || memberDetails?.marketState) {
      // Check if booking needs market data
      const { data: currentBooking } = await supabase
        .from('bookings')
        .select('market_city, market_state')
        .eq('id', bookingId)
        .single();
      
      if (!currentBooking?.market_city && memberDetails.marketCity) {
        const { error: marketUpdateError } = await supabase
          .from('bookings')
          .update({
            market_city: memberDetails.marketCity,
            market_state: memberDetails.marketState || null
          })
          .eq('id', bookingId);
        
        if (marketUpdateError) {
          console.error('[Background] Market enrichment error:', marketUpdateError);
        } else {
          console.log(`[Background] Market enriched: ${memberDetails.marketCity}, ${memberDetails.marketState}`);
        }
      }
    }

    // Clear timeout on success
    clearTimeout(timeoutId);
    console.log(`[Background] Transcription completed successfully for booking ${bookingId}`);

    // ===== AUTO-GENERATE QA SCORES (coaching audio is now on-demand) =====
    console.log(`[Background] Triggering automatic QA scoring (coaching audio deferred to on-demand)...`);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Helper function with retry logic and failure tracking
    async function callDownstreamFunction(
      functionName: string,
      maxRetries: number = 2
    ): Promise<{ success: boolean; statusCode?: number; error?: string }> {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          console.log(`[Downstream] Calling ${functionName} for ${bookingId} (attempt ${attempt + 1}/${maxRetries + 1})`);
          
          const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ bookingId }),
          });

          if (response.ok) {
            console.log(`[Downstream] ${functionName} succeeded for ${bookingId}`);
            return { success: true, statusCode: response.status };
          }

          const errorBody = await response.text();
          console.error(`[Downstream] ${functionName} failed (${response.status}): ${errorBody}`);

          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            try {
              await supabase.from('failed_downstream_calls').insert({
                booking_id: bookingId,
                function_name: functionName,
                status_code: response.status,
                error_message: errorBody.substring(0, 1000),
                attempt_count: attempt + 1,
              });
            } catch (logError) {
              console.error(`[Downstream] Failed to log to tracking table:`, logError);
            }
            return { success: false, statusCode: response.status, error: errorBody };
          }

          if (attempt < maxRetries) {
            const delay = Math.pow(2, attempt) * 1000;
            console.log(`[Downstream] Retrying ${functionName} in ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
          }
        } catch (networkError) {
          console.error(`[Downstream] Network error calling ${functionName}:`, networkError);
          if (attempt === maxRetries) {
            try {
              await supabase.from('failed_downstream_calls').insert({
                booking_id: bookingId,
                function_name: functionName,
                status_code: null,
                error_message: String(networkError).substring(0, 1000),
                attempt_count: attempt + 1,
              });
            } catch (logError) {
              console.error(`[Downstream] Failed to log network error:`, logError);
            }
            return { success: false, error: String(networkError) };
          }
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`[Downstream] Retrying ${functionName} after network error in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
        }
      }
      return { success: false, error: 'Max retries exceeded' };
    }

    // Coaching audio (Jeff & Katty) is NO LONGER auto-generated.
    // It will be generated on-demand when agents click "Play Coaching".
    // This saves ~$0.34 per record in TTS costs.

    // QA scoring always runs (cheap text-only AI analysis)
    const qaResult = await callDownstreamFunction('generate-qa-scores');
    if (!qaResult.success) {
      console.error(`[Background] QA scoring failed permanently for ${bookingId}: ${qaResult.error || qaResult.statusCode}`);
    }

    console.log(`[Background] All automation triggers dispatched for booking ${bookingId}`);

    // === HARD-WIRED COST PROTECTION ===
    // Audit cost after all processing completes
    await auditBookingCost(supabase, bookingId, skipTts);

  } catch (error) {
    // Clear timeout on error
    clearTimeout(timeoutId);
    const errorMessage = error instanceof Error ? error.message : 'Unknown transcription error';
    console.error(`[Background] Transcription failed for booking ${bookingId}:`, errorMessage);
    
    // Update status to failed WITH error message for debugging
    await updateBookingError(supabase, bookingId, errorMessage);
    console.log(`[Background] Status updated to failed for booking ${bookingId} with error: ${errorMessage}`);
  }
}

// === HARD-WIRED COST AUDIT FUNCTION ===
async function auditBookingCost(supabase: any, bookingId: string, skipTts: boolean) {
  try {
    // Only audit non-TTS cost ceiling when TTS was skipped
    if (!skipTts) {
      console.log(`[CostAudit] Skipping audit for ${bookingId} - TTS was included (different cost profile)`);
      return;
    }

    // Query all api_costs for this booking
    const { data: costs, error } = await supabase
      .from('api_costs')
      .select('service_type, estimated_cost_usd, service_provider')
      .eq('booking_id', bookingId);

    if (error) {
      console.error(`[CostAudit] Failed to query costs for ${bookingId}:`, error);
      return;
    }

    if (!costs || costs.length === 0) {
      console.log(`[CostAudit] No costs recorded for ${bookingId}`);
      return;
    }

    // Sum non-TTS costs
    const nonTtsCosts = costs.filter((c: any) => !c.service_type.startsWith('tts_'));
    const totalNonTts = nonTtsCosts.reduce((sum: number, c: any) => sum + (c.estimated_cost_usd || 0), 0);

    // Build breakdown by service type
    const breakdown: Record<string, number> = {};
    for (const c of nonTtsCosts) {
      breakdown[c.service_type] = (breakdown[c.service_type] || 0) + (c.estimated_cost_usd || 0);
    }

    console.log(`[CostAudit] Booking ${bookingId}: $${totalNonTts.toFixed(4)} non-TTS (limit: $${MAX_COST_PER_RECORD_NO_TTS})`);

    // CHECK 1: Single record ceiling breach
    if (totalNonTts > MAX_COST_PER_RECORD_NO_TTS) {
      const breakdownStr = Object.entries(breakdown)
        .map(([k, v]) => `${k}: $${v.toFixed(4)}`)
        .join(', ');

      console.error(`[CostAudit] CEILING BREACH for ${bookingId}: $${totalNonTts.toFixed(4)} > $${MAX_COST_PER_RECORD_NO_TTS}`);

      await supabase.from('admin_notifications').insert({
        notification_type: 'cost_ceiling_breach',
        service: 'billing',
        title: `Cost Ceiling Breach: Booking ${bookingId.substring(0, 8)}...`,
        message: `Record processed at $${totalNonTts.toFixed(4)} (limit: $${MAX_COST_PER_RECORD_NO_TTS}). Services: ${breakdownStr}`,
        severity: 'critical',
        metadata: {
          booking_id: bookingId,
          total_non_tts_cost: totalNonTts,
          ceiling: MAX_COST_PER_RECORD_NO_TTS,
          breakdown,
          all_costs: costs,
        },
      });
    }

    // CHECK 2: Rolling average of last N records today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: recentCosts, error: recentError } = await supabase
      .from('api_costs')
      .select('booking_id, estimated_cost_usd, service_type')
      .gte('created_at', todayStart.toISOString())
      .not('service_type', 'like', 'tts_%')
      .order('created_at', { ascending: false })
      .limit(500); // Grab enough to find N unique bookings

    if (recentError || !recentCosts) {
      console.error(`[CostAudit] Failed to query rolling average:`, recentError);
      return;
    }

    // Group by booking_id, take last N unique bookings
    const bookingTotals = new Map<string, number>();
    for (const c of recentCosts) {
      if (!c.booking_id) continue;
      bookingTotals.set(c.booking_id, (bookingTotals.get(c.booking_id) || 0) + (c.estimated_cost_usd || 0));
    }

    const recentBookingCosts = Array.from(bookingTotals.values()).slice(0, ROLLING_AVERAGE_WINDOW);
    if (recentBookingCosts.length < 3) {
      console.log(`[CostAudit] Not enough records for rolling average (${recentBookingCosts.length})`);
      return;
    }

    const rollingAvg = recentBookingCosts.reduce((a, b) => a + b, 0) / recentBookingCosts.length;
    console.log(`[CostAudit] Rolling avg (${recentBookingCosts.length} records): $${rollingAvg.toFixed(4)}`);

    if (rollingAvg > MAX_COST_PER_RECORD_NO_TTS) {
      // Check if we already fired this alert today
      const { data: existingAlert } = await supabase
        .from('admin_notifications')
        .select('id')
        .eq('notification_type', 'cost_rolling_avg_breach')
        .gte('created_at', todayStart.toISOString())
        .eq('is_resolved', false)
        .maybeSingle();

      if (!existingAlert) {
        await supabase.from('admin_notifications').insert({
          notification_type: 'cost_rolling_avg_breach',
          service: 'billing',
          title: `Rolling Average Cost Alert`,
          message: `Average cost per record today: $${rollingAvg.toFixed(4)} across ${recentBookingCosts.length} records (limit: $${MAX_COST_PER_RECORD_NO_TTS})`,
          severity: 'critical',
          metadata: {
            rolling_average: rollingAvg,
            ceiling: MAX_COST_PER_RECORD_NO_TTS,
            records_checked: recentBookingCosts.length,
            triggered_by_booking: bookingId,
          },
        });
        console.error(`[CostAudit] ROLLING AVERAGE BREACH: $${rollingAvg.toFixed(4)} > $${MAX_COST_PER_RECORD_NO_TTS}`);
      } else {
        console.log(`[CostAudit] Rolling average breach already alerted today`);
      }
    }
  } catch (err) {
    console.error(`[CostAudit] Unexpected error:`, err);
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingId, kixieUrl, skipTts = false } = await req.json();
    
    if (!bookingId || !kixieUrl) {
      throw new Error('Missing bookingId or kixieUrl');
    }
    
    console.log(`Received transcription request for booking ${bookingId} (skipTts: ${skipTts})`);

    // Validate required env vars before starting
    const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
    const deepgramApiKey = Deno.env.get('DEEPGRAM_API_KEY');
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    // At least one STT provider must be configured
    if (!elevenLabsApiKey && !deepgramApiKey) {
      throw new Error('No STT provider configured. Set ELEVENLABS_API_KEY or DEEPGRAM_API_KEY');
    }
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Fire-and-forget: Start background task with skipTts flag
    EdgeRuntime.waitUntil(processTranscription(bookingId, kixieUrl, skipTts));

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
