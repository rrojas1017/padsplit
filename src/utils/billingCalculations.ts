// Cost estimation based on current API pricing

export const PRICING = {
  elevenlabs: {
    tts_per_character: 0.00015,
    stt_per_minute: 0.034,
  },
  deepgram: {
    stt_per_minute: 0.0043,
  },
  lovable_ai: {
    input_per_1k_tokens: 0.0001,
    output_per_1k_tokens: 0.0003,
  },
  ai_polish: {
    input_per_1k_tokens: 0.00005,
    output_per_1k_tokens: 0.00015,
  },
};

// SOW Pricing - default rates matching the Statement of Work
export const SOW_PRICING = {
  voice_processing: { rate: 0.15, discountRate: 0.12, threshold: 5000, unit: 'per_record' },
  text_processing: { rate: 0.04, discountRate: 0.025, threshold: 5000, unit: 'per_record' },
  data_appending: { rate: 0.30, discountRate: 0.20, threshold: 5000, unit: 'per_record' },
  email_delivery: { rate: 0.01, unit: 'per_email' },
  sms_delivery: { rate: 0.05, unit: 'per_segment' },
  chat_delivery: { rate: 0.02, unit: 'per_interaction' },
  telephony: { rate: 0.012, unit: 'per_minute' },
  voice_coaching: { rate: 0.55, unit: 'per_record' },
} as const;

export const SOW_CATEGORY_LABELS: Record<string, string> = {
  voice_processing: 'AI Processing – Voice-Based Records',
  text_processing: 'AI Processing – Text-Based Records',
  data_appending: 'Data Appending & Enrichment',
  email_delivery: 'Outbound Email Delivery',
  sms_delivery: 'Outbound SMS Delivery',
  chat_delivery: 'Chat/Messaging Delivery',
  telephony: 'Telephony Services',
  voice_coaching: 'Voice Feedback, QA & Sales Coaching',
};

export const SOW_UNIT_LABELS: Record<string, string> = {
  per_record: '/record',
  per_email: '/email',
  per_segment: '/segment',
  per_interaction: '/interaction',
  per_minute: '/min',
};

export interface SOWLineItem {
  service_category: string;
  description: string;
  quantity: number;
  unit_rate: number;
  subtotal: number;
  is_optional: boolean;
  sort_order: number;
}

export interface SOWPricingConfig {
  id: string;
  service_category: string;
  description: string;
  base_rate: number;
  volume_tier_1_threshold: number | null;
  volume_tier_1_rate: number | null;
  unit: string;
  is_optional: boolean;
  is_active: boolean;
}

export function getApplicableRate(
  config: SOWPricingConfig,
  monthlyVolume: number
): number {
  if (
    config.volume_tier_1_threshold &&
    config.volume_tier_1_rate &&
    monthlyVolume >= config.volume_tier_1_threshold
  ) {
    return Number(config.volume_tier_1_rate);
  }
  return Number(config.base_rate);
}

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
  deepseek: 'DeepSeek',
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

export const CALCULATOR_PRICING = {
  stt: {
    deepgram: 0.0043,
    elevenlabs: 0.034,
  },
  llm: {
    deepseek: 0.0007,
    gemini_flash: 0.009,
    gemini_pro: 0.04,
  },
  polish: 0.0006,
  tts: {
    jeff_coaching: 0.18,
    katty_qa: 0.16,
  },
  qa_scoring: 0.0001,
  speaker_id: 0.00007,
};

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
