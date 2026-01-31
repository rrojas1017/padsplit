// Cost estimation based on current API pricing

export const PRICING = {
  elevenlabs: {
    // ElevenLabs Pro Plan effective rates (credits-based)
    // Pro Plan: $99/mo for 500k credits = ~2,880 min STT or ~1M chars TTS
    // STT: ~$0.034 per minute (Pro Plan)
    tts_per_character: 0.00015,
    // STT: ~$0.034 per minute (Pro Plan) - was $0.10 pay-as-you-go
    stt_per_minute: 0.034,
  },
  deepgram: {
    // Deepgram Nova-3 pricing
    // Pay-as-you-go: $0.0043 per minute
    stt_per_minute: 0.0043,
  },
  lovable_ai: {
    // Lovable AI (Gemini Flash): approximate pricing
    input_per_1k_tokens: 0.0001,
    output_per_1k_tokens: 0.0003,
  },
  // Flash-lite pricing for transcript polishing
  ai_polish: {
    input_per_1k_tokens: 0.00005,
    output_per_1k_tokens: 0.00015,
  },
};

export function calculateElevenLabsTTSCost(characterCount: number): number {
  return characterCount * PRICING.elevenlabs.tts_per_character;
}

export function calculateElevenLabsSTTCost(audioDurationSeconds: number): number {
  const minutes = audioDurationSeconds / 60;
  return minutes * PRICING.elevenlabs.stt_per_minute;
}

export function calculateDeepgramSTTCost(audioDurationSeconds: number): number {
  const minutes = audioDurationSeconds / 60;
  return minutes * PRICING.deepgram.stt_per_minute;
}

export function calculateSTTCost(audioDurationSeconds: number, provider: 'elevenlabs' | 'deepgram'): number {
  const minutes = audioDurationSeconds / 60;
  const rate = provider === 'deepgram' ? PRICING.deepgram.stt_per_minute : PRICING.elevenlabs.stt_per_minute;
  return minutes * rate;
}


export function calculateLovableAICost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1000) * PRICING.lovable_ai.input_per_1k_tokens;
  const outputCost = (outputTokens / 1000) * PRICING.lovable_ai.output_per_1k_tokens;
  return inputCost + outputCost;
}

// Estimate token count from text (rough approximation: ~4 chars per token)
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount);
}

export function formatCurrencyCompact(amount: number): string {
  if (amount >= 1000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      minimumFractionDigits: 2,
    }).format(amount);
  }
  return formatCurrency(amount);
}

export const SERVICE_TYPE_LABELS: Record<string, string> = {
  stt_transcription: 'Speech-to-Text (Transcription)',
  transcript_polishing: 'AI Transcript Polishing',
  tts_coaching: 'Text-to-Speech (Jeff Coaching)',
  tts_qa_coaching: 'Text-to-Speech (Katty QA)',
  ai_analysis: 'AI Analysis (Call Processing)',
  ai_coaching: 'AI Coaching (Feedback Generation)',
  ai_qa_scoring: 'AI QA Scoring',
  ai_member_insights: 'AI Member Insights',
  ai_reanalysis: 'AI Re-Analysis',
  speaker_identification: 'AI Speaker Identification',
};

export const PROVIDER_LABELS: Record<string, string> = {
  elevenlabs: 'ElevenLabs',
  deepgram: 'Deepgram',
  lovable_ai: 'Lovable AI',
};

export const FUNCTION_LABELS: Record<string, string> = {
  'transcribe-call': 'Call Transcription',
  'generate-coaching-audio': 'Jeff Coaching Audio',
  'generate-qa-coaching-audio': 'Katty QA Audio',
  'generate-qa-scores': 'QA Scoring',
  'regenerate-coaching': 'Coaching Regeneration',
  'reanalyze-call': 'Call Re-Analysis',
  'analyze-member-insights': 'Member Insights',
  'batch-generate-qa-scores': 'Batch QA Scoring',
  'batch-generate-qa-coaching': 'Batch Katty Audio',
  'batch-regenerate-coaching': 'Batch Coaching',
};
